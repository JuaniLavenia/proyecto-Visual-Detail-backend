/**
 * Rate Limiter Middleware
 * Configurable rate limiting per endpoint
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

// Default limiter for all routes
const defaultLimiter = createRateLimiter();

// Stricter limiter for auth endpoints
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per 15 min
});

// Very strict limiter for login specifically
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100 // 100 attempts per 15 min
});

// Limiter for static assets (images, files) - much higher limit
const staticLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500 // 500 requests per 15 min for images/files
});

module.exports = {
  defaultLimiter,
  authLimiter,
  loginLimiter,
  staticLimiter,
  createRateLimiter
};