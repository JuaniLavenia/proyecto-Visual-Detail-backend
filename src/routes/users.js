const express = require("express");
const router = express.Router();
const {
  getUserInfo,
  getUsers,
  updateUser,
  createUser,
  adminUpdateUser,
  deleteUser,
  updateUserRole,
  sendPasswordResetLink,
} = require("../controllers/users.controller");
const { body, param } = require("express-validator");
const { requestValidation } = require("../middleware/common.middleware");
const { authenticate } = require("../middleware/auth.middleware");
const { isAdmin } = require("../middleware/admin.middleware");
const {
  listUsersQueryValidation,
  createUserValidation,
  updateUserValidation,
  userIdParamValidation,
} = require("../validators/user.validators");

// ========== RUTAS AUTENTICADAS ==========

// GET /users - listar usuarios paginados con búsqueda, filtros y KPIs (solo admins)
router.get(
  "/users",
  authenticate,
  isAdmin,
  listUsersQueryValidation,
  requestValidation,
  getUsers
);

// POST /users - crear usuario y enviarle la invitación (solo admins)
router.post(
  "/users",
  authenticate,
  isAdmin,
  createUserValidation,
  requestValidation,
  createUser
);

// PATCH /users/:id - editar nombre, email, rol y estado (solo admins)
router.patch(
  "/users/:id",
  authenticate,
  isAdmin,
  updateUserValidation,
  requestValidation,
  adminUpdateUser
);

// DELETE /users/:id - eliminar usuario sin pedidos (solo admins)
router.delete(
  "/users/:id",
  authenticate,
  isAdmin,
  userIdParamValidation,
  requestValidation,
  deleteUser
);

// PUT /users/:id/role - cambiar rol de usuario (solo admins)
router.put(
  "/users/:id/role",
  authenticate,
  isAdmin,
  [
    ...userIdParamValidation,
    body("role")
      .isIn(["minorista", "mayorista", "admin"])
      .withMessage("Role inválido. Debe ser: minorista, mayorista o admin"),
  ],
  requestValidation,
  updateUserRole
);

// POST /users/:id/password-reset - enviar link de recuperación (solo admins)
router.post(
  "/users/:id/password-reset",
  authenticate,
  isAdmin,
  [
    param("id").isMongoId().withMessage("ID de usuario inválido"),
  ],
  requestValidation,
  sendPasswordResetLink
);

// GET /user/:id - obtener info de un usuario
// Autenticado: usuarios normales solo pueden ver su propio perfil
// Admins pueden ver cualquier perfil
router.get(
  "/user/:id",
  authenticate,
  [
    param("id").isMongoId().withMessage("ID de usuario inválido"),
  ],
  requestValidation,
  getUserInfo
);

// PUT /user/:id - actualizar perfil de usuario
// El usuario solo puede modificar su propio perfil
router.put(
  "/user/:id",
  authenticate,
  [
    param("id").isMongoId().withMessage("ID de usuario inválido"),
    body("email").optional().isEmail().withMessage("Email inválido"),
  ],
  requestValidation,
  updateUser
);

module.exports = router;