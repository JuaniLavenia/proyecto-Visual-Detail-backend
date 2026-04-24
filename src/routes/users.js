const express = require("express");
const router = express.Router();
const {
  getUserInfo,
  getUsers,
  updateUser,
  updateUserRole,
} = require("../controllers/users.controller");
const { body, param } = require("express-validator");
const { requestValidation } = require("../middleware/common.middleware");
const { authenticate } = require("../middleware/auth.middleware");
const { isAdmin } = require("../middleware/admin.middleware");

// ========== RUTAS AUTENTICADAS ==========

// GET /users - listar usuarios (solo admins ven todos, usuarios normales ven solo los suyos)
router.get(
  "/users",
  authenticate,
  getUsers
);

// PUT /users/:id/role - cambiar rol de usuario (solo admins)
router.put(
  "/users/:id/role",
  authenticate,
  isAdmin,
  [
    param("id").isMongoId().withMessage("ID de usuario inválido"),
    body("role")
      .isIn(["minorista", "mayorista", "admin"])
      .withMessage("Role inválido. Debe ser: minorista, mayorista o admin"),
  ],
  requestValidation,
  updateUserRole
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