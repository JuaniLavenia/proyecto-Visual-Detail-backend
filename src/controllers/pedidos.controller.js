/**
 * Pedidos Controller
 * Handles HTTP requests for order operations
 * Delegates to PedidoService for business logic
 */

const pedidoService = require('../services/pedido.service');
const { asyncHandler, AppError } = require('../middleware/error.middleware');
const { success } = require('../utils/response-formatter');

const createPedido = asyncHandler(async (req, res, next) => {
  const { productos, usuario } = req.body;
  const pedido = await pedidoService.create({ productos, usuario });
  res.status(201).json(success(pedido, 'Pedido creado exitosamente'));
});

const getPedidos = asyncHandler(async (req, res, next) => {
  const requestedUserId = req.params.userId;
  const currentUserId = req.userId?.toString();
  const isAdmin = req.userRole === 'admin';

  if (!isAdmin && currentUserId !== requestedUserId) {
    throw new AppError('Solo podés ver tus propios pedidos', 403, 'FORBIDDEN');
  }

  const pedidos = await pedidoService.findByUser(requestedUserId);
  res.json(success({ pedidos }));
});

const cancelPedido = asyncHandler(async (req, res, next) => {
  const pedido = await pedidoService.findById(req.params.id);

  if (!pedido) {
    throw new AppError('Pedido no encontrado', 404, 'NOT_FOUND');
  }

  const currentUserId = req.userId?.toString();
  const isAdmin = req.userRole === 'admin';

  // Solo admins o el propietario pueden cancelar
  if (!isAdmin && pedido.usuario.toString() !== currentUserId) {
    throw new AppError('Solo podés cancelar tus propios pedidos', 403, 'FORBIDDEN');
  }

  if (pedido.estado !== 'Pendiente') {
    return res.status(400).json({
      success: false,
      error: {
        message: 'No se puede cancelar un pedido que no está pendiente',
        code: 'INVALID_STATE'
      }
    });
  }

  const updated = await pedidoService.update(req.params.id, { estado: 'Cancelado' });
  res.json(success({ pedido: updated }, 'Pedido cancelado'));
});

const modificarEstadoPedido = asyncHandler(async (req, res, next) => {
  const { nuevoEstado } = req.body;
  const pedido = await pedidoService.findById(req.params.id);

  if (!pedido) {
    throw new AppError('Pedido no encontrado', 404, 'NOT_FOUND');
  }

  const currentUserId = req.userId?.toString();
  const isAdmin = req.userRole === 'admin';

  if (!isAdmin && pedido.usuario.toString() !== currentUserId) {
    throw new AppError('Solo podés modificar tus propios pedidos', 403, 'FORBIDDEN');
  }

  const estadosPermitidos = ['Pendiente', 'Completado', 'Cancelado'];
  if (!estadosPermitidos.includes(nuevoEstado)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Estado no válido',
        code: 'INVALID_STATE'
      }
    });
  }

  const updated = await pedidoService.update(req.params.id, { estado: nuevoEstado });
  res.json(success({ pedido: updated }, 'Estado actualizado'));
});

// ========== ADMIN CONTROLLERS ==========

/**
 * Get all orders with user data (admin view) - with pagination
 */
const getAllPedidos = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const estado = req.query.estado || null;

  const result = await pedidoService.findAllWithUser(page, limit, estado);
  res.json(success(result));
});

/**
 * Get dashboard statistics (basic)
 */
const getPedidosStats = asyncHandler(async (req, res, next) => {
  const stats = await pedidoService.getStats();
  res.json(success(stats));
});

/**
 * Get full dashboard stats including stock and users
 */
const getFullStats = asyncHandler(async (req, res, next) => {
  const stats = await pedidoService.getFullStats();
  res.json(success(stats));
});

/**
 * Get recent orders for dashboard
 */
const getRecentPedidos = asyncHandler(async (req, res, next) => {
  const limit = parseInt(req.query.limit) || 10;
  const pedidos = await pedidoService.getRecentOrders(limit);
  res.json(success({ pedidos }));
});

/**
 * Update order status (admin only)
 */
const updatePedidoStatus = asyncHandler(async (req, res, next) => {
  const { nuevoEstado } = req.body;

  const estadosPermitidos = ['Pendiente', 'Completado', 'Cancelado'];
  if (!estadosPermitidos.includes(nuevoEstado)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Estado no válido',
        code: 'INVALID_STATE'
      }
    });
  }

  const pedido = await pedidoService.update(req.params.id, { estado: nuevoEstado });
  res.json(success({ pedido }, 'Estado actualizado'));
});

module.exports = {
  createPedido,
  getPedidos,
  cancelPedido,
  modificarEstadoPedido,
  // Admin controllers
  getAllPedidos,
  getPedidosStats,
  getFullStats,
  getRecentPedidos,
  updatePedidoStatus,
};