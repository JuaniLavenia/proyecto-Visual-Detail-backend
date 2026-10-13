const CartItem = require("../models/Cart");
const { AppError } = require("../middleware/error.middleware");
const { asyncHandler } = require("../middleware/error.middleware");
const { success } = require("../utils/response-formatter");
const { loadUserProducts, createListIfMissing } = require("../utils/user-product-list");

const sendCart = async (res, userId, message) => {
  const products = await loadUserProducts(CartItem, userId);
  res.status(200).json(success({ products }, message));
};

const getUserCart = asyncHandler(async (req, res, next) => {
  const requestedUserId = req.params.userId;
  const currentUserId = req.userId?.toString();
  const isAdmin = req.userRole === 'admin';

  if (!isAdmin && currentUserId !== requestedUserId) {
    throw new AppError('Solo podés ver tu propio carrito', 403, 'FORBIDDEN');
  }

  await sendCart(res, requestedUserId, "Carrito");
});

const addToCart = asyncHandler(async (req, res, next) => {
  const { productId, quantity } = req.body;
  const currentUserId = req.userId?.toString();

  // Siempre usar el usuario autenticado
  const userId = currentUserId;

  let existingCartItem = await CartItem.findOne({ userId });

  if (!existingCartItem) {
    const created = await createListIfMissing(CartItem, userId, {
      product: productId,
      quantity: quantity || 1,
    });
    if (created) {
      await sendCart(res, userId, "Producto agregado al carrito");
      return;
    }
    // A concurrent first add created the cart: update it instead
    existingCartItem = await CartItem.findOne({ userId });
    if (!existingCartItem) {
      throw new AppError('No se pudo actualizar el carrito, intentá de nuevo', 409, 'CONCURRENT_UPDATE');
    }
  }

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

  await sendCart(res, userId, "Producto agregado al carrito");
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

  await sendCart(res, urlUserId, "Producto eliminado del carrito");
});

module.exports = {
  getUserCart,
  addToCart,
  removeFromCart,
};
