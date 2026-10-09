const { Schema, model } = require('mongoose');
const { slugify } = require('../utils/slugify');
const { isHttpUrlOrEmpty, IMAGE_URL_MAX_LENGTH } = require('../utils/image-url');

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
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
    // Home card image: empty or an absolute http(s) URL
    image: {
      type: String,
      default: '',
      trim: true,
      maxlength: IMAGE_URL_MAX_LENGTH,
      validate: {
        validator: isHttpUrlOrEmpty,
        message: 'image debe ser una URL http(s)',
      },
    },
    showOnHome: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

categorySchema.pre('validate', function preValidate(next) {
  if (!this.name) {
    return next();
  }

  if (!this.slug || this.isModified('name')) {
    this.slug = slugify(this.name);
  }

  next();
});

categorySchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  return obj;
};

module.exports = model('Category', categorySchema);
