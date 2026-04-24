const CartItem = require("../models/Cart");
const { AppError } = require("../middleware/error.middleware");
const { asyncHandler } = require("../middleware/error.middleware");

const getUserCart = asyncHandler(async (req, res, next) => {
  const requestedUserId = req.params.userId;
  const currentUserId = req.userId?.toString();
  const isAdmin = req.userRole === 'admin';

  if (!isAdmin && currentUserId !== requestedUserId) {
    throw new AppError('Solo podés ver tu propio carrito', 403, 'FORBIDDEN');
  }

  const cartItems = await CartItem.findOne({ userId: requestedUserId }).populate("products.product");
  res.status(200).json({ message: "Carrito", data: cartItems });
});

const addToCart = asyncHandler(async (req, res, next) => {
  const { productId, quantity } = req.body;
  const currentUserId = req.userId?.toString();

  // Siempre usar el usuario autenticado
  const userId = currentUserId;

  const existingCartItem = await CartItem.findOne({ userId });

  if (existingCartItem) {
    const existingProduct = existingCartItem.products.find(
      (p) => p.product.toString() === productId
    );

    if (existingProduct) {
      if (quantity !== undefined && quantity !== existingProduct.quantity) {
        existingProduct.quantity = quantity;
      }
    } else {
      existingCartItem.products.push({
        product: productId,
        quantity: quantity || 1,
      });
    }

    await existingCartItem.save();
  } else {
    const newCartItem = new CartItem({
      userId,
      products: [{ product: productId, quantity: quantity || 1 }],
    });
    await newCartItem.save();
  }

  res.status(200).json({ message: "Producto agregado al carrito" });
});

const removeFromCart = asyncHandler(async (req, res, next) => {
  const { userId: urlUserId, productId } = req.params;
  const currentUserId = req.userId?.toString();
  const isAdmin = req.userRole === 'admin';

  if (!isAdmin && currentUserId !== urlUserId) {
    throw new AppError('Solo podés modificar tu propio carrito', 403, 'FORBIDDEN');
  }

  const existingCartItem = await CartItem.findOne({ userId: urlUserId });

  if (existingCartItem) {
    existingCartItem.products = existingCartItem.products.filter(
      (p) => p.product.toString() !== productId
    );
    await existingCartItem.save();
  }

  res.status(200).json({ message: "Producto eliminado del carrito" });
});

module.exports = {
  getUserCart,
  addToCart,
  removeFromCart,
};