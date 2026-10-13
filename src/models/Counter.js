const { Schema, model } = require("mongoose");

// Named sequences incremented atomically with $inc (e.g. { _id: "numeroPedido", seq: 41 })
const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

module.exports = model("Counter", counterSchema);
