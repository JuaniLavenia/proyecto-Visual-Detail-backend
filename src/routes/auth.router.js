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
  authEmailRule,
  loginPasswordRule,
  passwordRule,
  passwordWithConfirmationRule,
} = require("../validators/auth.validators");
const {
  loginLimiter,
  sessionLimiter,
  authLimiter,
  passwordResetLimiter,
} = require("../middleware/rate-limiter");

const router = express.Router();

// Login with rate limiting and validation (no length rule: existing users
// may have shorter passwords)
router.post(
  "/login",
  loginLimiter,
  [authEmailRule(), loginPasswordRule()],
  requestValidation,
  login
);

// Register with validation
router.post(
  "/register",
  authLimiter,
  [authEmailRule(), passwordWithConfirmationRule()],
  requestValidation,
  register
);

// Refresh token - NO validacion tradicional, pero requiere body
router.post(
  "/refresh",
  sessionLimiter,
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
  sessionLimiter,
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
  [authEmailRule()],
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
    passwordRule(),
  ],
  requestValidation,
  resetPassword
);

module.exports = router;
