const express = require("express");
const { createPedido } = require("../controllers/pedidos.controller");
const router = express.Router();

router.post("/pedidos", createPedido);

module.exports = router;
