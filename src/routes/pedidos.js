const express = require("express");
const {
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
} = require("../controllers/pedidos.controller");
const { body, param, query } = require("express-validator");
const { requestValidation } = require("../middleware/common.middleware");
const { isAdmin } = require("../middleware/admin.middleware");
const { authenticate } = require("../middleware/auth.middleware");
const router = express.Router();

// ========== RUTAS PÚBLICAS / SEMI-PÚBLICAS ==========

// POST /pedidos - crear pedido (guest checkout sin auth, pero con validation)
router.post(
  "/pedidos",
  [
    body("usuario").notEmpty().withMessage("Usuario es requerido"),
    body("productos").isArray({ min: 1 }).withMessage("Productos debe ser un array no vacío"),
  ],
  requestValidation,
  createPedido
);

// ========== RUTAS DE USUARIO AUTENTICADO ==========

// GET /pedidos/:userId - obtener pedidos del usuario
router.get(
  "/pedidos/:userId",
  authenticate,
  [
    param("userId").notEmpty().withMessage("User ID es requerido"),
  ],
  requestValidation,
  getPedidos
);

// PUT /pedido/cancelar/:id - cancelar pedido propio (usuario autenticado)
router.put(
  "/pedido/cancelar/:id",
  authenticate,
  [
    param("id").isMongoId().withMessage("ID de pedido inválido"),
  ],
  requestValidation,
  cancelPedido
);

// PUT /pedido/modificar/:id - modificar estado (usuario propietario del pedido)
router.put(
  "/pedido/modificar/:id",
  authenticate,
  [
    param("id").isMongoId().withMessage("ID de pedido inválido"),
    body("nuevoEstado")
      .isIn(["Pendiente", "Completado", "Cancelado"])
      .withMessage("Estado debe ser: Pendiente, Completado o Cancelado"),
  ],
  requestValidation,
  modificarEstadoPedido
);

// ========== ADMIN ROUTES ==========

// GET /admin/pedidos - Get all orders with pagination (admin only)
router.get(
  "/admin/pedidos",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("Page debe ser >= 1"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit debe ser 1-100"),
    query("estado").optional().isIn(["todos", "Pendiente", "Completado", "Cancelado"]).withMessage("Estado inválido"),
  ],
  requestValidation,
  authenticate,
  isAdmin,
  getAllPedidos
);

// GET /admin/pedidos/stats - Get basic dashboard statistics (admin only)
router.get(
  "/admin/pedidos/stats",
  authenticate,
  isAdmin,
  getPedidosStats
);

// GET /admin/estadisticas - Get full dashboard statistics with stock and users (admin only)
router.get(
  "/admin/estadisticas",
  authenticate,
  isAdmin,
  getFullStats
);

// GET /admin/pedidos/recent - Get recent orders (admin only)
router.get(
  "/admin/pedidos/recent",
  [
    query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Limit debe ser un número entre 1 y 50"),
  ],
  requestValidation,
  authenticate,
  isAdmin,
  getRecentPedidos
);

// PUT /admin/pedidos/:id/status - Update order status (admin only)
router.put(
  "/admin/pedidos/:id/status",
  [
    param("id").isMongoId().withMessage("ID de pedido inválido"),
    body("nuevoEstado")
      .isIn(["Pendiente", "Completado", "Cancelado"])
      .withMessage("Estado debe ser: Pendiente, Completado o Cancelado"),
  ],
  requestValidation,
  authenticate,
  isAdmin,
  updatePedidoStatus
);

module.exports = router;