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

// GET /users - get all users
router.get("/users", getUsers);

// PUT /users/:id/role - update user role (admin only)
router.put(
  "/users/:id/role",
  [
    param("id")
      .isMongoId()
      .withMessage("ID de usuario inválido"),
    body("role")
      .isIn(["minorista", "mayorista", "admin"])
      .withMessage("Role inválido. Debe ser: minorista, mayorista o admin"),
  ],
  requestValidation,
  updateUserRole
);

// GET /user/:id - validate ID parameter
router.get(
  "/user/:id",
  [
    param("id")
      .isMongoId()
      .withMessage("ID de usuario inválido"),
  ],
  requestValidation,
  getUserInfo
);

// PUT /user/:id - validate ID and optional fields
router.put(
  "/user/:id",
  [
    param("id")
      .isMongoId()
      .withMessage("ID de usuario inválido"),
    body("email")
      .optional()
      .isEmail()
      .withMessage("Email inválido"),
  ],
  requestValidation,
  updateUser
);

module.exports = router;