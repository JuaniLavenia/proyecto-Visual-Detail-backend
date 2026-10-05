const express = require("express");
const {
  login,
  register,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
} = require("../controllers/auth.controller");
const { body, param } = require("express-validator");
const { requestValidation } = require("../middleware/common.middleware");
const {
  authLimiter,
  passwordResetLimiter,
} = require("../middleware/rate-limiter");

const router = express.Router();

// Login with rate limiting and validation
router.post(
  "/login",
  authLimiter,
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
  authLimiter,
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
  authLimiter,
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
  authLimiter,
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
  authLimiter,
  passwordResetLimiter,
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
  authLimiter,
  passwordResetLimiter,
  [
    param("id").isMongoId().withMessage("El link de recuperación es inválido"),
    param("token").notEmpty().withMessage("El link de recuperación es inválido"),
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