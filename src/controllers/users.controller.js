/**
 * Users Controller
 * Handles HTTP requests for user operations
 * Delegates to UserService for business logic
 */

const userService = require('../services/user.service');
const passwordResetService = require('../services/password-reset.service');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const { success, paginated } = require('../utils/response-formatter');

const PROFILE_EDITABLE_FIELDS = ['email'];

const getUserInfo = asyncHandler(async (req, res, next) => {
  const requestedId = req.params.id;
  const currentUserId = req.userId?.toString();
  const isAdmin = req.userRole === 'admin';

  // Usuarios normales solo pueden ver su propio perfil
  if (!isAdmin && currentUserId !== requestedId) {
    throw new AppError('No podés ver el perfil de otro usuario', 403, 'FORBIDDEN');
  }

  const user = await userService.findById(requestedId);
  res.json(success({ usuario: user }));
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

  // Whitelist: role/password/refreshToken have dedicated flows and must never
  // be writable through the profile endpoint
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
  res.json(success({ usuario: user }, 'Usuario modificado'));
});

const updateUserRole = asyncHandler(async (req, res, next) => {
  // isAdmin middleware ya valida que el que hace la request es admin
  const { role } = req.body;
  const user = await userService.updateRole(req.params.id, role);
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
  updateUserRole,
  sendPasswordResetLink,
};