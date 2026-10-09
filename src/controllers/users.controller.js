/**
 * Users Controller
 * Handles HTTP requests for user operations
 * Delegates to UserService for business logic
 */

const userService = require('../services/user.service');
const passwordResetService = require('../services/password-reset.service');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const { success, paginated } = require('../utils/response-formatter');
const { ADMIN_EDITABLE_FIELDS, PROFILE_EDITABLE_FIELDS } = require('../validators/user.validators');

// Profile payload: name and phone are always present (null when unset)
const toProfile = (user) => ({ ...user, name: user.name ?? null, phone: user.phone ?? null });

const getUserInfo = asyncHandler(async (req, res, next) => {
  const requestedId = req.params.id;
  const currentUserId = req.userId?.toString();
  const isAdmin = req.userRole === 'admin';

  // Usuarios normales solo pueden ver su propio perfil
  if (!isAdmin && currentUserId !== requestedId) {
    throw new AppError('No podés ver el perfil de otro usuario', 403, 'FORBIDDEN');
  }

  const user = await userService.findById(requestedId);
  res.json(success({ usuario: toProfile(user) }));
});

// Admin only (route guarded by isAdmin). Query params already validated.
const getUsers = asyncHandler(async (req, res, next) => {
  // Absent page/limit fall back to the service defaults
  const page = parseInt(req.query.page) || undefined;
  const limit = parseInt(req.query.limit) || undefined;
  const { search, role, status, sort } = req.query;

  // Counts cover ALL users so the KPIs do not change with the filters
  const [result, counts] = await Promise.all([
    userService.list({ page, limit, search, role, status, sort }),
    userService.getCounts(),
  ]);

  res.json(
    paginated(
      result.users,
      {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalUsers: result.total,
        limit: result.limit,
      },
      { counts }
    )
  );
});

const updateUser = asyncHandler(async (req, res, next) => {
  const requestedId = req.params.id;
  const currentUserId = req.userId?.toString();
  const isAdmin = req.userRole === 'admin';

  // Solo admins pueden modificar cualquier usuario
  // Usuarios normales solo pueden modificar su propio perfil
  if (!isAdmin && currentUserId !== requestedId) {
    throw new AppError('Solo podés modificar tu propio perfil', 403, 'FORBIDDEN');
  }

  // Whitelist (the route already rejects anything else): email, role,
  // password and refreshToken have dedicated flows and must never be
  // writable through the profile endpoint
  const updates = {};
  for (const field of PROFILE_EDITABLE_FIELDS) {
    if (req.body?.[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No hay campos editables en la solicitud', 400, 'VALIDATION_ERROR');
  }

  const user = await userService.update(requestedId, updates);
  res.json(success({ usuario: toProfile(user) }, 'Usuario modificado'));
});

// Admin only. Body already validated and normalized.
const createUser = asyncHandler(async (req, res, next) => {
  const { email, name, role } = req.body;
  const user = await userService.createByAdmin({ email, name, role });

  // The user stays created if the mail fails: the admin can resend it with
  // the password-reset action.
  let inviteSent = true;
  try {
    await passwordResetService.sendInviteMail(user);
  } catch (err) {
    console.error('Invite mail failed:', err.code || err.message);
    inviteSent = false;
  }

  const message = inviteSent
    ? 'Usuario creado. Le enviamos un correo para que defina su contraseña'
    : 'Usuario creado, pero no se pudo enviar el correo de invitación';
  res.status(201).json(success({ user: user.toJSON(), inviteSent }, message));
});

// Admin only. Whitelisted here too, independently of the route validation.
const adminUpdateUser = asyncHandler(async (req, res, next) => {
  const updates = {};
  for (const field of ADMIN_EDITABLE_FIELDS) {
    if (req.body?.[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No hay campos editables en la solicitud', 400, 'VALIDATION_ERROR');
  }

  const user = await userService.updateByAdmin(req.params.id, req.userId, updates);
  res.json(success({ user }, 'Usuario actualizado'));
});

// Admin only
const deleteUser = asyncHandler(async (req, res, next) => {
  await userService.deleteByAdmin(req.params.id, req.userId);
  res.json(success(null, 'Usuario eliminado'));
});

const updateUserRole = asyncHandler(async (req, res, next) => {
  // isAdmin middleware ya valida que el que hace la request es admin
  const { role } = req.body;
  const user = await userService.updateRole(req.params.id, req.userId, role);
  res.json(success({ usuario: user }, 'Rol actualizado'));
});

const sendPasswordResetLink = asyncHandler(async (req, res, next) => {
  // isAdmin middleware ya valida que el que hace la request es admin
  await passwordResetService.sendResetLinkToUser(req.params.id);
  res.json(success(null, 'Link de recuperación enviado'));
});

module.exports = {
  getUserInfo,
  getUsers,
  updateUser,
  createUser,
  adminUpdateUser,
  deleteUser,
  updateUserRole,
  sendPasswordResetLink,
};