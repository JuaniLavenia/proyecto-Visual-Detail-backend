const { Schema, model } = require("mongoose");
const User = require("./User");

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
