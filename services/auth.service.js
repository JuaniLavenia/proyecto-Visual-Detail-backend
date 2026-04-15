/**
 * Auth Service
 * Handles authentication logic: login, register, refresh tokens, logout
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { sanitizeFindQuery } = require('../utils/query-sanitizer');
const { AppError } = require('../middlewares/error.middleware');

class AuthService {
  /**
   * Generate JWT tokens
   */
  generateTokens(userId) {
    const accessToken = jwt.sign(
      { uid: userId },
      config.get('jwt.secret'),
      { expiresIn: config.get('jwt.accessExpiry') }
    );

    const refreshToken = jwt.sign(
      { uid: userId, type: 'refresh' },
      config.get('jwt.secret'),
      { expiresIn: config.get('jwt.refreshExpiry') }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Login user
   */
  async login(email, password) {
    // Sanitize email query to prevent injection
    const sanitizedQuery = sanitizeFindQuery({ email: email.toLowerCase() });
    
    const user = await User.findOne(sanitizedQuery);
    if (!user) {
      throw new AppError('El correo y/o la contraseña son incorrectos', 401, 'AUTH_INVALID');
    }

    const passwordCorrecto = await user.comparePassword(password);
    if (!passwordCorrecto) {
      throw new AppError('El correo y/o la contraseña son incorrectos', 401, 'AUTH_INVALID');
    }

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user.id);
    
    // Store refresh token (in production, hash it for security)
    user.refreshToken = refreshToken;
    await user.save();

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken
    };
  }

  /**
   * Register new user
   */
  async register(email, password) {
    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError('El correo ya está registrado', 409, 'USER_EXISTS');
    }

    const user = new User({
      email,
      password
    });

    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user.id);
    
    // Store refresh token
    user.refreshToken = refreshToken;
    await user.save();

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refresh(refreshToken) {
    if (!refreshToken) {
      throw new AppError('Refresh token es requerido', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.get('jwt.secret'));
      
      if (decoded.type !== 'refresh') {
        throw new AppError('Token inválido', 401, 'INVALID_TOKEN');
      }

      // Find user and verify stored refresh token
      const user = await User.findById(decoded.uid);
      if (!user || user.refreshToken !== refreshToken) {
        throw new AppError('Token inválido o revocado', 401, 'INVALID_TOKEN');
      }

      // Generate new tokens (rotation)
      const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(user.id);

      // Update stored refresh token (rotation)
      user.refreshToken = newRefreshToken;
      await user.save();

      return { accessToken, refreshToken: newRefreshToken };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError('Token expirado', 401, 'TOKEN_EXPIRED');
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new AppError('Token inválido', 401, 'INVALID_TOKEN');
      }
      throw err;
    }
  }

  /**
   * Logout user
   */
  async logout(refreshToken) {
    if (!refreshToken) {
      throw new AppError('Refresh token es requerido', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    try {
      const decoded = jwt.verify(refreshToken, config.get('jwt.secret'));
      const user = await User.findById(decoded.uid);
      
      if (user) {
        user.refreshToken = null;
        await user.save();
      }

      return true;
    } catch (err) {
      // Even if token is invalid, consider logout successful
      return true;
    }
  }
}

module.exports = new AuthService();