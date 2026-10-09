const bcrypt = require("bcryptjs");
const { Schema, model } = require("mongoose");

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    lowercase: true,
    index: { unique: true },
  },
  password: {
    type: String,
    required: true,
  },
  // SHA-256 hex digest of the current refresh token, never the token itself
  // (see services/auth.service.js). null = no active session.
  refreshToken: {
    type: String,
    default: null,
  },
  role: {
    type: String,
    enum: ["minorista", "mayorista", "admin"],
    default: "minorista",
  },
  name: {
    type: String,
    trim: true,
    maxlength: 80,
  },
  // Contact phone, normalized to an optional leading "+" and digits only
  // (see validators/pedido.validators.js). Saved from checkout.
  phone: {
    type: String,
    trim: true,
  },
  // Documents created before this field existed lack it: treat missing as active
  // (check `isActive === false`, never `!isActive`).
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

userSchema.pre("save", async function () {
  // Only hash if password is modified (new or changed). A hashing error
  // rejects the hook and fails the save: never store a plain-text password.
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

const User = model("User", userSchema);

module.exports = User;
