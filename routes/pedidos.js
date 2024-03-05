const express = require("express");
const {
  createPedido,
  getPedidos,
  cancelPedido,
  modificarEstadoPedido,
} = require("../controllers/pedidos.controller");
const router = express.Router();

router.post("/pedidos", createPedido);
router.get("/pedidos/:userId", getPedidos);
router.put("/pedido/cancelar/:id", cancelPedido);
router.put("/pedido/modificar/:id", modificarEstadoPedido);

module.exports = router;
