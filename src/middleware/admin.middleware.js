/**
 * Admin Middleware
 * Verifies if the authenticated user has admin role
 * Uses the authenticate middleware to populate req.user first.
 *
 * Usage: router.get('/admin-route', authenticate, isAdmin, handler)
 */

const { AppError } = require('./error.middleware');

/**
 * Middleware to verify admin role
 * MUST be used AFTER the authenticate middleware
 * (which populates req.user with the full user document)
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Autenticación requerida', 401, 'AUTH_REQUIRED'));
  }

  if (req.user.role !== 'admin') {
    return next(new AppError('Acceso denegado - Se requiere rol de administrador', 403, 'ADMIN_REQUIRED'));
  }

  next();
};

module.exports = { isAdmin };