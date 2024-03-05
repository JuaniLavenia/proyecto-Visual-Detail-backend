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

const getPedidos = async (req, res) => {
  try {
    const { userId } = req.params;

    const orders = await Pedido.find({ usuario: userId });

    res.status(200).json({ mensaje: "Lista de pedidos", pedidos: orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los pedidos" });
  }
};

const cancelPedido = async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);

    if (!pedido) {
      return res.status(404).json({ message: "Pedido no encontrado" });
    }

    if (pedido.estado !== "Pendiente") {
      return res.status(400).json({
        message: "No se puede cancelar un pedido que no está pendiente",
      });
    }

    pedido.estado = "Cancelado";
    await pedido.save();

    res.status(201).json({ message: "Pedido modificado", pedido: pedido });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al cancelar el pedido" });
  }
};

const modificarEstadoPedido = async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);

    if (!pedido) {
      return res.status(404).json({ message: "Pedido no encontrado" });
    }

    const { nuevoEstado } = req.body;

    const estadosPermitidos = ["Pendiente", "Completado", "Cancelado"];
    if (!estadosPermitidos.includes(nuevoEstado)) {
      return res.status(400).json({ message: "Estado no válido" });
    }

    pedido.estado = nuevoEstado;
    await pedido.save();

    res.status(201).json({ message: "Pedido modificado", pedido: pedido });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error al modificar el estado del pedido" });
  }
};

module.exports = {
  createPedido,
  getPedidos,
  cancelPedido,
  modificarEstadoPedido,
};
