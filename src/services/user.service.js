/**
 * User Service
 * Handles user CRUD operations
 */

const crypto = require('crypto');
const User = require('../models/User');
const Order = require('../models/Order');
const CartItem = require('../models/Cart');
const Favorite = require('../models/Favorite');
const { sanitizeFindQuery, sanitizeUpdateQuery } = require('../utils/query-sanitizer');
const { AppError } =require('../middleware/error.middleware');
const { escapeRegex } = require('./product-query');

const notFoundError = () => new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
const emailInUseError = () =>
  new AppError('El correo ya está en uso por otro usuario', 409, 'EMAIL_IN_USE');

// A concurrent request can pass the availability check and still hit the
// unique index on save: report it as the same domain error.
const mapDuplicateEmail = (err) =>
  err && err.code === 11000 ? emailInUseError() : err;

// Admin-created users never get a usable known password: they set their own
// through the invite link.
const randomPassword = () => crypto.randomBytes(32).toString('hex');

// Missing `isActive` counts as active (legacy documents)
const ACTIVE_ADMINS_FILTER = () => ({ role: 'admin', isActive: { $ne: false } });

const USER_ROLES = ['minorista', 'mayorista', 'admin'];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

// Legacy documents lack `isActive`: missing counts as active, so "active"
// is `$ne: false` (matches true and missing) and only an explicit false is inactive.
// Factories, so callers never share (and Mongoose never casts in place) one object.
const STATUS_FILTERS = {
  active: () => ({ isActive: { $ne: false } }),
  inactive: () => ({ isActive: false }),
};

// Fixed sort map: the client picks a key, never a raw sort object.
// Legacy users have no createdAt; Mongo sorts missing values lowest, so they
// go last under "newest" and the _id tie-break keeps pages deterministic.
const SORT_MAP = {
  newest: { createdAt: -1, _id: -1 },
  email: { email: 1, _id: 1 },
};
const DEFAULT_SORT = 'newest';

const own = (map, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(map, key);

/**
 * Build the admin users list filter. `search` is raw user input and is
 * escaped before going into $regex.
 *
 * The result must NOT go through sanitizeFindQuery: it strips "$" from
 * string values, which would corrupt an escaped "\$" into a dangling "\".
 * Keys are fixed here and every value is checked, so there is no operator
 * injection surface.
 */
const buildUserFilter = ({ search, role, status } = {}) => {
  const filter = {};
  if (typeof role === 'string' && USER_ROLES.includes(role)) {
    filter.role = role;
  }
  if (own(STATUS_FILTERS, status)) {
    Object.assign(filter, STATUS_FILTERS[status]());
  }
  if (typeof search === 'string' && search.trim().length > 0) {
    const regex = { $regex: escapeRegex(search.trim()), $options: 'i' };
    filter.$or = [{ email: regex }, { name: regex }];
  }
  return filter;
};

class UserService {
  /**
   * Find user by ID
   */
  async findById(id) {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }
    return user.toJSON();
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    const sanitizedQuery = sanitizeFindQuery({ email: email.toLowerCase() });
    const user = await User.findOne(sanitizedQuery);
    if (!user) {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }
    return user;
  }

  /**
   * Admin list: filtered, sorted and paginated, without secrets
   */
  async list({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, search, role, status, sort } = {}) {
    const filter = buildUserFilter({ search, role, status });
    const sortBy = { ...SORT_MAP[own(SORT_MAP, sort) ? sort : DEFAULT_SORT] };
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -refreshToken')
        .sort(sortBy)
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * KPI counts over ALL users (independent of list filters)
   */
  async getCounts() {
    const [total, admins, mayoristas, minoristas, inactive] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'mayorista' }),
      User.countDocuments({ role: 'minorista' }),
      User.countDocuments(STATUS_FILTERS.inactive()),
    ]);

    return {
      total,
      admins,
      mayoristas,
      minoristas,
      active: total - inactive,
      inactive,
    };
  }

  /**
   * Update user
   */
  async update(id, updateData) {
    const sanitizedUpdate = sanitizeUpdateQuery(updateData);
    const user = await User.findByIdAndUpdate(
      id,
      sanitizedUpdate,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }
    
    return user.toJSON();
  }

  /**
   * Reject an email already used by another user
   */
  async assertEmailAvailable(email, excludeId = null) {
    const filter = excludeId ? { email, _id: { $ne: excludeId } } : { email };
    if (await User.exists(filter)) {
      throw emailInUseError();
    }
  }

  /**
   * Admin safety rules shared by edit, role change and delete:
   * - an admin cannot deactivate, delete or change the role of their own account;
   * - the last active admin cannot be deactivated, deleted or demoted.
   *
   * Check-then-act: two concurrent requests can each see two active admins
   * and both proceed. Acceptable for a small admin team; see the B3 report.
   */
  async assertAdminSafety(target, actorId, { remove = false, roleChange = false, deactivate = false } = {}) {
    if (!remove && !roleChange && !deactivate) {
      return;
    }

    if (actorId != null && String(target._id) === String(actorId)) {
      throw new AppError(
        'No podés desactivar, eliminar ni cambiar el rol de tu propia cuenta',
        403,
        'SELF_ACTION_FORBIDDEN'
      );
    }

    const isActiveAdmin = target.role === 'admin' && target.isActive !== false;
    if (isActiveAdmin && (remove || roleChange || deactivate)) {
      const activeAdmins = await User.countDocuments(ACTIVE_ADMINS_FILTER());
      if (activeAdmins <= 1) {
        throw new AppError(
          'No se puede desactivar, eliminar ni quitar el rol al último administrador activo',
          409,
          'LAST_ADMIN'
        );
      }
    }
  }

  /**
   * Admin creates a user with a random password. Returns the saved document
   * (the invite link is signed with its password hash); never expose it as is.
   */
  async createByAdmin({ email, name, role } = {}) {
    const normalizedEmail = String(email).trim().toLowerCase();
    await this.assertEmailAvailable(normalizedEmail);

    const user = new User({
      email: normalizedEmail,
      role: role || 'minorista',
      password: randomPassword(),
      ...(name !== undefined && { name }),
    });

    try {
      // save() so the pre-save hook hashes the password
      await user.save();
    } catch (err) {
      throw mapDuplicateEmail(err);
    }
    return user;
  }

  /**
   * Admin edits name, email, role and/or isActive. Role changes and
   * deactivation revoke the stored refresh token in the same save.
   */
  async updateByAdmin(id, actorId, updates = {}) {
    const user = await User.findById(id);
    if (!user) {
      throw notFoundError();
    }

    const roleChange = updates.role !== undefined && updates.role !== user.role;
    const deactivate = updates.isActive === false && user.isActive !== false;
    await this.assertAdminSafety(user, actorId, { roleChange, deactivate });

    if (updates.email !== undefined) {
      const email = String(updates.email).trim().toLowerCase();
      if (email !== user.email) {
        await this.assertEmailAvailable(email, user._id);
        user.email = email;
      }
    }
    if (updates.name !== undefined) {
      user.name = updates.name;
    }
    if (roleChange) {
      user.role = updates.role;
    }
    if (updates.isActive !== undefined) {
      user.isActive = updates.isActive;
    }
    if (roleChange || deactivate) {
      // Single session: clearing the refresh token logs the user out
      user.refreshToken = null;
    }

    try {
      await user.save();
    } catch (err) {
      throw mapDuplicateEmail(err);
    }
    return user.toJSON();
  }

  /**
   * Admin role change (PUT /users/:id/role): same guards and revocation
   */
  async updateRole(id, actorId, role) {
    return this.updateByAdmin(id, actorId, { role });
  }

  /**
   * Admin hard delete, only for users without orders. Also removes the
   * user's cart items and favorites. Deleting the document also ends the
   * session (refresh and authenticate no longer find the user).
   */
  async deleteByAdmin(id, actorId) {
    const user = await User.findById(id);
    if (!user) {
      throw notFoundError();
    }

    await this.assertAdminSafety(user, actorId, { remove: true });

    if (await Order.exists({ usuario: user._id })) {
      throw new AppError(
        'El usuario tiene pedidos registrados y no se puede eliminar. Podés desactivarlo en su lugar',
        409,
        'USER_HAS_ORDERS'
      );
    }

    await User.deleteOne({ _id: user._id });
    await Promise.all([
      CartItem.deleteMany({ userId: user._id }),
      Favorite.deleteMany({ userId: user._id }),
    ]);
  }
}

const userService = new UserService();
userService.buildUserFilter = buildUserFilter;

module.exports = userService;