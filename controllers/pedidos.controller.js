const Pedido = require("../models/Pedido");

const createPedido = async (req, res) => {
  try {
    const { productos, usuario } = req.body;

    const nuevoPedido = new Pedido({
      usuario,
      productos,
    });

    await nuevoPedido.save();

    res.status(201).json({ mensaje: "Pedido creado exitosamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

module.exports = {
  createPedido,
};
