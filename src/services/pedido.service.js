/**
 * Pedido Service
 * Handles order CRUD operations
 */

const Pedido = require('../models/Order');
const User = require('../models/User');
const Producto = require('../models/Product');
const { sanitizeFindQuery, sanitizeUpdateQuery } = require('../utils/query-sanitizer');
const { AppError } = require('../middleware/error.middleware');
const { escapeRegex } = require('./product-query');
const { buildUserFilter } = require('./user.service');
const { normalizePhone, MAX_PRODUCT_QUANTITY } = require('../validators/pedido.validators');

const ESTADOS = ['Pendiente', 'Completado', 'Cancelado'];
const PHONE_LIKE = /^\+?\d+$/;

/**
 * Build the admin orders list filter. `search` matches the order number
 * (exact, when numeric), the phone snapshot (escaped regex; phone-like
 * input is compacted like the stored value) and the orders of `userIds`
 * (users whose email/name matched the same search).
 *
 * The result must NOT go through sanitizeFindQuery: it strips "$" from
 * string values, which would corrupt an escaped "\$" into a dangling "\".
 * Keys are fixed here and every value is checked.
 */
const buildPedidoFilter = ({ estado, search, userIds = [] } = {}) => {
  const filter = {};
  if (typeof estado === 'string' && ESTADOS.includes(estado)) {
    filter.estado = estado;
  }

  const term = typeof search === 'string' ? search.trim() : '';
  if (!term) return filter;

  const or = [];
  if (/^\d+$/.test(term) && Number.isSafeInteger(Number(term))) {
    or.push({ numeroPedido: Number(term) });
  }
  const compact = term.replace(/[\s()-]/g, '');
  const phoneTerm = PHONE_LIKE.test(compact) ? compact : term;
  or.push({ telefono: { $regex: escapeRegex(phoneTerm), $options: 'i' } });
  if (Array.isArray(userIds) && userIds.length > 0) {
    or.push({ usuario: { $in: userIds } });
  }
  filter.$or = or;
  return filter;
};

/**
 * Admin view of a lean order: always carries `telefono` (null for legacy
 * orders) and `fecha` = createdAt, or the ObjectId creation time for
 * orders created before timestamps existed.
 */
const toAdminOrder = (order) => {
  const idDate = typeof order._id?.getTimestamp === 'function' ? order._id.getTimestamp() : null;
  return {
    ...order,
    telefono: order.telefono ?? null,
    fecha: order.createdAt ?? idDate,
  };
};

/**
 * Unit price for a buyer role: mayoristas pay the wholesale price when the
 * product has one; everyone else pays the retail price.
 */
const unitPriceFor = (product, role) =>
  role === 'mayorista' && typeof product.precioMayorista === 'number'
    ? product.precioMayorista
    : product.price;

const roundMoney = (value) => Math.round(value * 100) / 100;

/**
 * Build the stored order lines from validated `{ productId, cantidad }`
 * lines. Duplicates are merged; name and price always come from the
 * database, so the client cannot set them.
 */
const priceOrderLines = async (productos, role) => {
  const quantities = new Map();
  for (const { productId, cantidad } of productos) {
    const id = String(productId);
    const merged = (quantities.get(id) || 0) + cantidad;
    if (merged > MAX_PRODUCT_QUANTITY) {
      throw new AppError(
        `La cantidad de un producto no puede superar ${MAX_PRODUCT_QUANTITY}`,
        400,
        'VALIDATION_ERROR'
      );
    }
    quantities.set(id, merged);
  }

  const ids = [...quantities.keys()];
  const products = await Producto.find({ _id: { $in: ids } })
    .select('name price precioMayorista')
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  if (ids.some((id) => !byId.has(id))) {
    throw new AppError('Uno o más productos no existen', 400, 'PRODUCT_NOT_FOUND');
  }

  const lines = ids.map((id) => {
    const product = byId.get(id);
    return {
      producto: product._id,
      nombre: product.name,
      cantidad: quantities.get(id),
      precio: unitPriceFor(product, role),
    };
  });
  const total = roundMoney(lines.reduce((sum, line) => sum + line.precio * line.cantidad, 0));
  return { lines, total };
};

class PedidoService {
  /**
   * Get all pedidos with pagination
   */
  async findAll(query = {}) {
    const sanitizedQuery = sanitizeFindQuery(query);
    const pedidos = await Pedido.find(sanitizedQuery).sort({ _id: -1 });
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
   * Create an order for the authenticated user. `telefono` must already be
   * validated and normalized; when given it also becomes the profile phone,
   * otherwise the stored profile phone is used. One of them is required.
   */
  async createForUser(user, { productos = [], telefono } = {}) {
    // A stored phone may predate normalization (e.g. "3814159688"); one
    // that cannot be normalized counts as missing so the client asks again
    const phone = telefono || (user.phone ? normalizePhone(user.phone) : null);
    if (!phone) {
      throw new AppError(
        'Necesitamos un teléfono de contacto para crear el pedido',
        400,
        'PHONE_REQUIRED'
      );
    }

    // Priced before the profile update, so a rejected order changes nothing
    const { lines, total } = await priceOrderLines(productos, user.role);

    // Profile first: if it fails, no order is created (a client retry
    // would otherwise duplicate the order)
    if (phone !== user.phone) {
      await User.updateOne({ _id: user._id }, { $set: { phone } });
    }

    return this.create({
      usuario: user._id,
      telefono: phone,
      productos: lines,
      total,
    });
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
    return await Pedido.find(sanitizedQuery).sort({ _id: -1 });
  }

  /**
   * Get all pedidos (admin view) with all data and pagination
   */
  async findAllWithUser({ page = 1, limit = 10, estado = null, search } = {}) {
    const term = typeof search === 'string' ? search.trim() : '';
    // Users whose email or name match, so their orders match too
    const userIds = term
      ? (await User.find(buildUserFilter({ search: term })).select('_id').lean()).map((u) => u._id)
      : [];
    const filter = buildPedidoFilter({ estado, search: term, userIds });
    const skip = (page - 1) * limit;

    const [pedidos, total] = await Promise.all([
      Pedido.find(filter)
        .populate('usuario', 'email role name phone')
        // _id is time-ordered, so this also sorts legacy orders without createdAt
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Pedido.countDocuments(filter)
    ]);

    return {
      pedidos: pedidos.map(toAdminOrder),
      total,
      page,
      limit,
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
      .sort({ _id: -1 })
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
  // Only walk plain objects: ObjectId, Date, etc. must keep their type
  if (Object.getPrototypeOf(obj) !== Object.prototype) return obj;

  const sanitized = {};
  for (const key in obj) {
    if (key.startsWith('$')) continue;
    sanitized[key] = sanitizeObject(obj[key]);
  }
  return sanitized;
};

const pedidoService = new PedidoService();
pedidoService.buildPedidoFilter = buildPedidoFilter;
pedidoService.toAdminOrder = toAdminOrder;

module.exports = pedidoService;