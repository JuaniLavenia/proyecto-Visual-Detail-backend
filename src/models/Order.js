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
  // producto and precio are missing on legacy orders, so they stay optional
  productos: [
    {
      producto: {
        type: Schema.Types.ObjectId,
        ref: "Producto",
      },
      nombre: String,
      cantidad: Number,
      // Unit price snapshot at order time
      precio: {
        type: Number,
        min: 0,
      },
    },
  ],
  // Sum of precio * cantidad; missing on legacy orders
  total: {
    type: Number,
    min: 0,
  },
  estado: {
    type: String,
    enum: ["Pendiente", "Completado", "Cancelado"],
    default: "Pendiente",
  },
  // Snapshot of the customer's phone at order time
  telefono: {
    type: String,
    trim: true,
  },
}, { timestamps: true });

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
