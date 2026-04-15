const { Schema, model } = require("mongoose");

const favoriteSchema = new Schema({
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
    },
  ],
});

favoriteSchema.path("products").validate(async function (value) {
  const uniqueProducts = [...new Set(value.map((p) => p.product.toString()))];
  return uniqueProducts.length === value.length;
}, "No se pueden agregar productos duplicados a favoritos");

const Favorite = model("Favorite", favoriteSchema);

module.exports = Favorite;
