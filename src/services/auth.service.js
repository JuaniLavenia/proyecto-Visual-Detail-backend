/**
 * Auth Service
 * Handles authentication logic: login, register, refresh tokens, logout
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { sanitizeFindQuery } = require('../utils/query-sanitizer');
const { AppError } = require('../middleware/error.middleware');

const USER_INACTIVE_MESSAGE = 'Tu cuenta está desactivada. Contactá a un administrador.';

// Legacy documents lack `isActive`: only an explicit `false` means inactive.
const isInactive = (user) => user.isActive === false;

const inactiveUserError = () => new AppError(USER_INACTIVE_MESSAGE, 403, 'USER_INACTIVE');

/**
 * Refresh tokens are never stored in plain text: User.refreshToken holds the
 * SHA-256 hex digest of the current token (a leaked DB row cannot be replayed).
 */
const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Constant-time comparison of the presented token against the stored hash
const refreshTokenMatches = (token, storedHash) => {
  if (!storedHash) return false;
  const presented = Buffer.from(hashRefreshToken(token), 'utf8');
  const stored = Buffer.from(storedHash, 'utf8');
  return presented.length === stored.length && crypto.timingSafeEqual(presented, stored);
};

class AuthService {
  /**
   * Generate JWT tokens
   */
  generateTokens(userId) {
    // `type` lets the auth middleware reject refresh tokens used as Bearer tokens
    const accessToken = jwt.sign(
      { uid: userId, type: 'access' },
      config.get('jwt.secret'),
      { expiresIn: config.get('jwt.accessExpiry') }
    );

    const refreshToken = jwt.sign(
      // jti makes every token unique, even two issued within the same second
      { uid: userId, type: 'refresh', jti: crypto.randomUUID() },
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

    // Checked only after the password matches, so the status does not leak to guessers
    if (isInactive(user)) {
      throw inactiveUserError();
    }

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user.id);
    
    // Store only the hash of the refresh token
    user.refreshToken = hashRefreshToken(refreshToken);
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
    
    // Store only the hash of the refresh token
    user.refreshToken = hashRefreshToken(refreshToken);
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
      if (!user) {
        throw new AppError('Token inválido o revocado', 401, 'INVALID_TOKEN');
      }

      // A validly signed token that is not the current one was already rotated
      // out (or revoked): treat it as reuse of a possibly stolen token and
      // revoke the current session too, forcing a new login.
      if (!refreshTokenMatches(refreshToken, user.refreshToken)) {
        if (user.refreshToken) {
          user.refreshToken = null;
          await user.save();
        }
        throw new AppError('Token inválido o revocado', 401, 'INVALID_TOKEN');
      }

      if (isInactive(user)) {
        // Revoke the session so the token cannot be retried after reactivation
        user.refreshToken = null;
        await user.save();
        throw inactiveUserError();
      }

      // Generate new tokens (rotation)
      const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(user.id);

      // Update stored refresh token hash (rotation)
      user.refreshToken = hashRefreshToken(newRefreshToken);
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
module.exports.USER_INACTIVE_MESSAGE = USER_INACTIVE_MESSAGE;