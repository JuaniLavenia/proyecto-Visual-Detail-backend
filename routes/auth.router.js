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
const {
  errorMidleware,
  requestValidation,
} = require("../middlewares/common.middleware");
const { loginLimiter } = require("../middlewares/rate-limiter");

const router = express.Router();

// Login with rate limiting and validation
router.post(
  "/login",
  loginLimiter,
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
  login,
  errorMidleware
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
  register,
  errorMidleware
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
  refresh,
  errorMidleware
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
  logout,
  errorMidleware
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
  forgotPassword,
  errorMidleware
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
  resetPassword,
  errorMidleware
);

module.exports = router;