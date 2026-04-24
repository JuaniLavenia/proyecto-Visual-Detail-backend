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
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json(options.message);
    }
  });
};

// Limiter para todos los endpoints de autenticación
// 100 requests cada 15 minutos es más que suficiente para uso legítimo
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per 15 min
});

module.exports = {
  authLimiter
};