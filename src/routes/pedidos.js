const express = require("express");
const {
  createPedido,
  getPedidos,
  cancelPedido,
  modificarEstadoPedido,
} = require("../controllers/pedidos.controller");
const { body, param } = require("express-validator");
const { requestValidation } = require("../middleware/common.middleware");
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

module.exports = router;