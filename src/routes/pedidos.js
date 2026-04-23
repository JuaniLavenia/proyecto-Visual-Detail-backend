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
const router = express.Router();

// POST /pedidos - validate pedido data
router.post(
  "/pedidos",
  [
    body("usuario")
      .notEmpty()
      .withMessage("Usuario es requerido"),
    body("productos")
      .isArray({ min: 1 })
      .withMessage("Productos debe ser un array no vacío"),
  ],
  requestValidation,
  createPedido
);

// GET /pedidos/:userId - validate userId
router.get(
  "/pedidos/:userId",
  [
    param("userId")
      .notEmpty()
      .withMessage("User ID es requerido"),
  ],
  requestValidation,
  getPedidos
);

// PUT /pedido/cancelar/:id - validate MongoDB ID
router.put(
  "/pedido/cancelar/:id",
  [
    param("id")
      .isMongoId()
      .withMessage("ID de pedido inválido"),
  ],
  requestValidation,
  cancelPedido
);

// PUT /pedido/modificar/:id - validate ID and estado
router.put(
  "/pedido/modificar/:id",
  [
    param("id")
      .isMongoId()
      .withMessage("ID de pedido inválido"),
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
  isAdmin,
  getAllPedidos
);

// GET /admin/pedidos/stats - Get basic dashboard statistics (admin only)
router.get(
  "/admin/pedidos/stats",
  isAdmin,
  getPedidosStats
);

// GET /admin/estadisticas - Get full dashboard statistics with stock and users (admin only)
router.get(
  "/admin/estadisticas",
  isAdmin,
  getFullStats
);

// GET /admin/pedidos/recent - Get recent orders (admin only)
router.get(
  "/admin/pedidos/recent",
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit debe ser un número entre 1 y 50"),
  ],
  requestValidation,
  isAdmin,
  getRecentPedidos
);

// PUT /admin/pedidos/:id/status - Update order status (admin only)
router.put(
  "/admin/pedidos/:id/status",
  [
    param("id")
      .isMongoId()
      .withMessage("ID de pedido inválido"),
    body("nuevoEstado")
      .isIn(["Pendiente", "Completado", "Cancelado"])
      .withMessage("Estado debe ser: Pendiente, Completado o Cancelado"),
  ],
  requestValidation,
  isAdmin,
  updatePedidoStatus
);

module.exports = router;