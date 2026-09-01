const { Schema, model } = require('mongoose');
const { slugify } = require('../utils/slugify');

const brandSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
      index: true,
      default: function defaultSlug() {
        return slugify(this.name || '');
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

brandSchema.pre('validate', function preValidate(next) {
  if (!this.name) {
    return next();
  }

  if (!this.slug || this.isModified('name')) {
    this.slug = slugify(this.name);
  }

  next();
});

brandSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  return obj;
};

module.exports = model('Brand', brandSchema);
