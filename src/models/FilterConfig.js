const { Schema, model } = require("mongoose");

const filterConfigSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: "plp",
    },
    filters: {
      type: [
        {
          key: { type: String, enum: ["category", "brand"], required: true },
          label: { type: String, required: true, trim: true },
          isActive: { type: Boolean, required: true, default: true },
          sortOrder: { type: Number, required: true, default: 0 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

module.exports = model("FilterConfig", filterConfigSchema);
