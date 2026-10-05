/**
 * User Service
 * Handles user CRUD operations
 */

const User = require('../models/User');
const { sanitizeFindQuery, sanitizeUpdateQuery } = require('../utils/query-sanitizer');
const { AppError } =require('../middleware/error.middleware');
const { escapeRegex } = require('./product-query');

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
   * Get all users (admin)
   */
  async findAll(query = {}) {
    const sanitizedQuery = sanitizeFindQuery(query);
    const users = await User.find(sanitizedQuery).select('-password -refreshToken');
    return users.map(user => user.toJSON());
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
   * Delete user (soft delete or hard delete)
   */
  async delete(id) {
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }
    return true;
  }

  /**
   * Update user role
   */
  async updateRole(id, role) {
    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }
    
    return user.toJSON();
  }
}

const userService = new UserService();
userService.buildUserFilter = buildUserFilter;

module.exports = userService;