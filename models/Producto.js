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
  },
  brand: {
    type: String,
    required: true,
  },
});

module.exports = model("Producto", schema);
