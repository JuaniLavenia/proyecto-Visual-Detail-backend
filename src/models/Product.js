const { Schema, model } = require("mongoose");

const schema = new Schema({
  name: {
    type: String,
    required: true,
  },
  description: String,
  image: String,
  price: {
    type: Number,
    required: true,
  },
  precioMayorista: {
    type: Number,
    default: null,
  },
  stock: {
    type: Number,
    required: true,
  },
  capacity: {
    type: String,
    required: true,
  },

  category: {
    type: String,
    required: true,
    index: true,
  },
  brand: {
    type: String,
    index: true,
  },
});

module.exports = model("Producto", schema);
