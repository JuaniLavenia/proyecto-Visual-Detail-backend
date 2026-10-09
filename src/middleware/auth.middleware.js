/**
 * Authentication Middleware
 * Verifies JWT token and populates req.user for all authenticated routes
 * This middleware should be used on any route that requires authentication.
 * After this middleware runs, req.user and req.userId are available.
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { AppError } = require('./error.middleware');
const { USER_INACTIVE_MESSAGE } = require('../services/auth.service');

const ACCESS_TOKEN_TYPE = 'access';

/**
 * Middleware to verify the user is authenticated
 * Attaches req.user (full user document) and req.userId to the request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token de autenticación no proporcionado', 401, 'NO_AUTH_TOKEN');
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, config.get('jwt.secret'));

    // Access and refresh tokens share the secret: only access tokens authenticate
    if (decoded.type !== ACCESS_TOKEN_TYPE) {
      throw new AppError('Token inválido', 401, 'INVALID_TOKEN');
    }

    // Get user from database
    const user = await User.findById(decoded.uid).select('-password -refreshToken');

    if (!user) {
      throw new AppError('Usuario no encontrado', 401, 'USER_NOT_FOUND');
    }

    // Legacy documents lack `isActive`: only an explicit `false` means inactive
    if (user.isActive === false) {
      throw new AppError(USER_INACTIVE_MESSAGE, 403, 'USER_INACTIVE');
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Token inválido', 401, 'INVALID_TOKEN'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expirado', 401, 'TOKEN_EXPIRED'));
    }
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError('Error de autenticación', 500, 'AUTH_ERROR'));
  }
};

module.exports = {
  authenticate
};