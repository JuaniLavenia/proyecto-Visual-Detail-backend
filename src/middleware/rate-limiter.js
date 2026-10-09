/**
 * Rate Limiter Middleware
 * Rate limiting SOLO para endpoints críticos de autenticación.
 * No se aplica globalmente porque rompe la navegación normal de usuarios.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || config.get('rateLimit.windowMs');
  const max = options.max || config.get('rateLimit.max');

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        message: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    },
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json(options.message);
    }
  });
};

// Login: strict against password guessing; successful logins do not count
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 failed attempts per 15 min
  skipSuccessfulRequests: true
});

// Refresh/logout: generous, so token rotation never eats the login budget
const sessionLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300 // 300 requests per 15 min
});

// Register, forgot and reset password
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30 // 30 requests per 15 min
});

// Limiter mas estricto para recuperacion de contraseña (envia mails)
const passwordResetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // 5 requests per 15 min
});

// Admin actions that send e-mails (invite, password reset link)
const adminMailLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30 // 30 requests per 15 min
});

module.exports = {
  loginLimiter,
  sessionLimiter,
  authLimiter,
  passwordResetLimiter,
  adminMailLimiter
};
