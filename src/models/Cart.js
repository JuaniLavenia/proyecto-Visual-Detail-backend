const { Schema, model } = require("mongoose");

const cartSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  products: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: "Producto",
        required: true,
      },
      quantity: {
        type: Number,
        default: 1,
      },
    },
  ],
});

cartSchema.path("products").validate(async function (value) {
  const uniqueProducts = [...new Set(value.map((p) => p.product.toString()))];
  return uniqueProducts.length === value.length;
}, "No se pueden agregar productos duplicados al carrito");

const CartItem = model("CartItem", cartSchema);

module.exports = CartItem;
