const express = require("express");
const {
  login,
  register,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
} = require("../controllers/auth.controller");
const { body } = require("express-validator");
const { requestValidation } = require("../middleware/common.middleware");

const router = express.Router();

// Login with rate limiting and validation
router.post(
  "/login",
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("El correo es requerido")
      .isEmail()
      .withMessage("El correo es incorrecto"),
    body("password")
      .notEmpty()
      .withMessage("La contraseña es requerida"),
  ],
  requestValidation,
  login
);

// Register with validation (existing)
router.post(
  "/register",
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("El correo es requerido")
      .isEmail()
      .withMessage("El correo es incorrecto"),
    body("password")
      .notEmpty()
      .withMessage("La contraseña es requerida")
      .isLength({ min: 6, max: 12 })
      .withMessage("La contraseña debe tener entre 6 y 12 caracteres")
      .custom((value, { req }) => value === req.body.password_confirmation)
      .withMessage("Las contraseñas no coincide"),
  ],
  requestValidation,
  register
);

// Refresh token - NO validacion tradicional, pero requiere body
router.post(
  "/refresh",
  [
    body("refreshToken")
      .notEmpty()
      .withMessage("Refresh token es requerido"),
  ],
  requestValidation,
  refresh
);

// Logout
router.post(
  "/logout",
  [
    body("refreshToken")
      .notEmpty()
      .withMessage("Refresh token es requerido"),
  ],
  requestValidation,
  logout
);

// Forgot password
router.post(
  "/forgot",
  [
    body("email")
      .trim()
      .notEmpty()
      .withMessage("El correo es requerido")
      .isEmail()
      .withMessage("El correo es incorrecto"),
  ],
  requestValidation,
  forgotPassword
);

// Reset password
router.post(
  "/reset/:id/:token",
  [
    body("password")
      .notEmpty()
      .withMessage("La contraseña es requerida")
      .isLength({ min: 6, max: 12 })
      .withMessage("La contraseña debe tener entre 6 y 12 caracteres"),
  ],
  requestValidation,
  resetPassword
);

module.exports = router;