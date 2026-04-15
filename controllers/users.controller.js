/**
 * Users Controller
 * Handles HTTP requests for user operations
 * Delegates to UserService for business logic
 */

const userService = require('../services/user.service');
const { asyncHandler } = require('../middlewares/error.middleware');
const { success } = require('../utils/response-formatter');

const getUserInfo = asyncHandler(async (req, res, next) => {
  const user = await userService.findById(req.params.id);
  res.json(success({ usuario: user }));
});

const getUsers = asyncHandler(async (req, res, next) => {
  const users = await userService.findAll();
  res.json(success({ usuarios: users }));
});

const updateUser = asyncHandler(async (req, res, next) => {
  const user = await userService.update(req.params.id, req.body);
  res.json(success({ usuario: user }, 'Usuario modificado'));
});

module.exports = {
  getUserInfo,
  getUsers,
  updateUser,
};