/**
 * Pedido Service
 * Handles order CRUD operations
 */

const Pedido = require('../models/Pedido');
const { sanitizeFindQuery, sanitizeUpdateQuery } = require('../utils/query-sanitizer');
const { AppError } = require('../middlewares/error.middleware');

class PedidoService {
  /**
   * Get all pedidos with pagination
   */
  async findAll(query = {}) {
    const sanitizedQuery = sanitizeFindQuery(query);
    const pedidos = await Pedido.find(sanitizedQuery).sort({ createdAt: -1 });
    return pedidos;
  }

  /**
   * Get pedido by ID
   */
  async findById(id) {
    const pedido = await Pedido.findById(id);
    if (!pedido) {
      throw new AppError('Pedido no encontrado', 404, 'PEDIDO_NOT_FOUND');
    }
    return pedido;
  }

  /**
   * Create pedido
   */
  async create(pedidoData) {
    const sanitizedData = sanitizeObject(pedidoData);
    const pedido = new Pedido(sanitizedData);
    return await pedido.save();
  }

  /**
   * Update pedido
   */
  async update(id, updateData) {
    const sanitizedUpdate = sanitizeUpdateQuery(updateData);
    const pedido = await Pedido.findByIdAndUpdate(
      id,
      sanitizedUpdate,
      { new: true, runValidators: true }
    );
    
    if (!pedido) {
      throw new AppError('Pedido no encontrado', 404, 'PEDIDO_NOT_FOUND');
    }
    
    return pedido;
  }

  /**
   * Get pedidos by user
   */
  async findByUser(userId) {
    const query = { userId };
    const sanitizedQuery = sanitizeFindQuery(query);
    return await Pedido.find(sanitizedQuery).sort({ createdAt: -1 });
  }
}

// Helper function at module level
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item));
  if (typeof obj !== 'object') return obj;
  
  const sanitized = {};
  for (const key in obj) {
    if (key.startsWith('$')) continue;
    sanitized[key] = sanitizeObject(obj[key]);
  }
  return sanitized;
};

module.exports = new PedidoService();