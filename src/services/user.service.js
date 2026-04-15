/**
 * User Service
 * Handles user CRUD operations
 */

const User = require('../models/User');
const { sanitizeFindQuery, sanitizeUpdateQuery } = require('../utils/query-sanitizer');
const { AppError } =require('../middleware/error.middleware');

class UserService {
  /**
   * Find user by ID
   */
  async findById(id) {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }
    return user.toJSON();
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    const sanitizedQuery = sanitizeFindQuery({ email: email.toLowerCase() });
    const user = await User.findOne(sanitizedQuery);
    if (!user) {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }
    return user;
  }

  /**
   * Get all users (admin)
   */
  async findAll(query = {}) {
    const sanitizedQuery = sanitizeFindQuery(query);
    const users = await User.find(sanitizedQuery).select('-password -refreshToken');
    return users.map(user => user.toJSON());
  }

  /**
   * Update user
   */
  async update(id, updateData) {
    const sanitizedUpdate = sanitizeUpdateQuery(updateData);
    const user = await User.findByIdAndUpdate(
      id,
      sanitizedUpdate,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }
    
    return user.toJSON();
  }

  /**
   * Delete user (soft delete or hard delete)
   */
  async delete(id) {
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }
    return true;
  }

  /**
   * Update user role
   */
  async updateRole(id, role) {
    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }
    
    return user.toJSON();
  }
}

module.exports = new UserService();