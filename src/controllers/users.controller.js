/**
 * Users Controller
 * Handles HTTP requests for user operations
 * Delegates to UserService for business logic
 */

const userService = require('../services/user.service');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const { success } = require('../utils/response-formatter');

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

const getUsers = asyncHandler(async (req, res, next) => {
  const currentUserId = req.userId?.toString();
  const isAdmin = req.userRole === 'admin';

  // Admins ven todos los usuarios, usuarios normales solo ven su propio registro
  if (isAdmin) {
    const users = await userService.findAll();
    return res.json(success({ usuarios: users }));
  }

  // Usuario normal: devolver solo su propio perfil
  const user = await userService.findById(currentUserId);
  res.json(success({ usuarios: [user] }));
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

  const user = await userService.update(requestedId, req.body);
  res.json(success({ usuario: user }, 'Usuario modificado'));
});

const updateUserRole = asyncHandler(async (req, res, next) => {
  // isAdmin middleware ya valida que el que hace la request es admin
  const { role } = req.body;
  const user = await userService.updateRole(req.params.id, role);
  res.json(success({ usuario: user }, 'Rol actualizado'));
});

module.exports = {
  getUserInfo,
  getUsers,
  updateUser,
  updateUserRole,
};