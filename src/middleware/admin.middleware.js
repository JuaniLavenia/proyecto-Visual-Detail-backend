/**
 * Admin Middleware
 * Verifies if the user has admin role
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { AppError } = require('./error.middleware');

/**
 * Middleware to verify admin role
 * Must be used AFTER auth middleware that populates req.user
 */
const isAdmin = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No autorizado - Token no proporcionado', 401, 'NO_AUTH_TOKEN');
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, config.get('jwt.secret'));
    
    // Get user from database
    const user = await User.findById(decoded.uid);
    
    if (!user) {
      throw new AppError('Usuario no encontrado', 401, 'USER_NOT_FOUND');
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      throw new AppError('Acceso denegado - Se requiere rol de administrador', 403, 'ADMIN_REQUIRED');
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Token inválido', 401, 'INVALID_TOKEN'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expirado', 401, 'TOKEN_EXPIRED'));
    }
    if (error.statusCode === 401 || error.statusCode === 403) {
      return next(error);
    }
    return next(new AppError('Error de autorización', 500, 'AUTH_ERROR'));
  }
};

module.exports = { isAdmin };
