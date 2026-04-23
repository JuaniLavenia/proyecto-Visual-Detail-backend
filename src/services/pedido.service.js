/**
 * Pedido Service
 * Handles order CRUD operations
 */

const Pedido = require('../models/Order');
const { sanitizeFindQuery, sanitizeUpdateQuery } = require('../utils/query-sanitizer');
const { AppError } = require('../middleware/error.middleware');

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
    const query = { usuario: userId };
    const sanitizedQuery = sanitizeFindQuery(query);
    return await Pedido.find(sanitizedQuery).sort({ createdAt: -1 });
  }

  /**
   * Get all pedidos (admin view) with all data and pagination
   */
  async findAllWithUser(page = 1, limit = 10, estado = null) {
    const query = estado && estado !== 'todos' ? { estado } : {};
    const skip = (page - 1) * limit;
    
    const [pedidos, total] = await Promise.all([
      Pedido.find(query)
        .populate('usuario', 'email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Pedido.countDocuments(query)
    ]);

    return {
      pedidos,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get orders statistics for dashboard
   */
  async getStats() {
    const total = await Pedido.countDocuments();
    const pendientes = await Pedido.countDocuments({ estado: 'Pendiente' });
    const completados = await Pedido.countDocuments({ estado: 'Completado' });
    const cancelados = await Pedido.countDocuments({ estado: 'Cancelado' });

    // Calculate revenue from completed orders
    const completedOrders = await Pedido.find({ estado: 'Completado' });
    const revenue = completedOrders.reduce((sum, pedido) => {
      const pedidoTotal = pedido.productos?.reduce((acc, prod) => {
        return acc + (prod.precio || 0) * (prod.cantidad || 0);
      }, 0);
      return sum + pedidoTotal;
    }, 0);

    return {
      total,
      pendientes,
      completados,
      cancelados,
      revenue
    };
  }

  /**
   * Get full dashboard stats including stock and users
   */
  async getFullStats() {
    const pedidoStats = await this.getStats();
    
    // Get Product model for stock stats
    const Product = require('../models/Product');
    const totalProductos = await Product.countDocuments();
    const productosSinStock = await Product.countDocuments({ stock: 0 });
    const productosBajoStock = await Product.countDocuments({ stock: { $gt: 0, $lte: 5 } });
    
    // Get User model for user stats
    const User = require('../models/User');
    const totalUsuarios = await User.countDocuments();

    return {
      pedidos: {
        total: pedidoStats.total,
        pendientes: pedidoStats.pendientes,
        completados: pedidoStats.completados,
        cancelados: pedidoStats.cancelados
      },
      ventas: {
        total: pedidoStats.revenue,
        // Note: more detailed time-based stats could be added later
      },
      stock: {
        total: totalProductos,
        productosSinStock,
        productosBajoStock
      },
      usuarios: {
        total: totalUsuarios
      }
    };
  }

  /**
   * Get recent orders for dashboard
   */
  async getRecentOrders(limit = 10) {
    return await Pedido.find()
      .populate('usuario', 'email role')
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Get orders by status for dashboard
   */
  async getOrdersByStatus() {
    const result = await Pedido.aggregate([
      {
        $group: {
          _id: '$estado',
          count: { $sum: 1 }
        }
      }
    ]);
    
    return result.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
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