const { Schema, model } = require("mongoose");
const { nextOrderNumber } = require("../services/order-counter");

const pedidoSchema = new Schema({
  numeroPedido: {
    type: Number,
    unique: true,
  },
  usuario: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
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
    index: true,
  },
  // Snapshot of the customer's phone at order time
  telefono: {
    type: String,
    trim: true,
  },
}, { timestamps: true });

// Atomic numbering (counter + $inc): concurrent orders never share a number
pedidoSchema.pre("save", async function () {
  if (!this.numeroPedido) {
    this.numeroPedido = await nextOrderNumber();
  }
});

const Pedido = model("Pedido", pedidoSchema);
module.exports = Pedido;
