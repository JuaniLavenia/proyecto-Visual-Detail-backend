const { Schema, model } = require("mongoose");

const pedidoSchema = new Schema({
  numeroPedido: {
    type: Number,
    unique: true,
  },
  usuario: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  productos: [
    {
      nombre: String,
      cantidad: Number,
    },
  ],
  estado: {
    type: String,
    enum: ["Pendiente", "Completado", "Cancelado"],
    default: "Pendiente",
  },
});

pedidoSchema.pre("save", async function (next) {
  try {
    if (!this.numeroPedido) {
      const ultimoPedido = await Pedido.findOne(
        {},
        {},
        { sort: { numeroPedido: -1 } }
      );
      this.numeroPedido = ultimoPedido ? ultimoPedido.numeroPedido + 1 : 1;
    }
    next();
  } catch (error) {
    next(error);
  }
});

const Pedido = model("Pedido", pedidoSchema);
module.exports = Pedido;
