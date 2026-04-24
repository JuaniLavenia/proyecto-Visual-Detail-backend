const Favorite = require("../models/Favorite");
const { AppError } = require("../middleware/error.middleware");
const { asyncHandler } = require("../middleware/error.middleware");

const getUserFavorites = asyncHandler(async (req, res, next) => {
  const requestedUserId = req.params.userId;
  const currentUserId = req.userId?.toString();
  const isAdmin = req.userRole === 'admin';

  // Validar que solo acceda a sus propios favoritos
  if (!isAdmin && currentUserId !== requestedUserId) {
    throw new AppError('Solo podés ver tus propios favoritos', 403, 'FORBIDDEN');
  }

  const favorites = await Favorite.findOne({ userId: requestedUserId }).populate("products.product");
  res.status(200).json({ message: "Favoritos", data: favorites });
});

const addFavorite = asyncHandler(async (req, res, next) => {
  const { productId } = req.body;
  const currentUserId = req.userId?.toString();

  // Siempre usar el usuario autenticado, no confiar en el body
  const userId = currentUserId;

  const existingFavorites = await Favorite.findOne({ userId });

  if (existingFavorites) {
    const existingProduct = existingFavorites.products.find(
      (p) => p.product.toString() === productId
    );
    if (!existingProduct) {
      existingFavorites.products.push({ product: productId });
      await existingFavorites.save();
      return res.status(200).json({ message: "Se agregó en favoritos" });
    } else {
      return res.status(400).json({ error: "El producto ya está en favoritos" });
    }
  } else {
    const newFavorite = new Favorite({
      userId,
      products: [{ product: productId }],
    });
    await newFavorite.save();
    return res.status(200).json({ message: "Se agregó en favoritos" });
  }
});

const deleteFavorite = asyncHandler(async (req, res, next) => {
  const { userId: urlUserId, productId } = req.params;
  const currentUserId = req.userId?.toString();
  const isAdmin = req.userRole === 'admin';

  // Validar que solo elimine de sus propios favoritos
  if (!isAdmin && currentUserId !== urlUserId) {
    throw new AppError('Solo podés eliminar tus propios favoritos', 403, 'FORBIDDEN');
  }

  const existingFavorites = await Favorite.findOne({ userId: urlUserId });

  if (existingFavorites) {
    existingFavorites.products = existingFavorites.products.filter(
      (p) => p.product.toString() !== productId
    );
    await existingFavorites.save();
    return res.status(200).json({ message: "Se eliminó de favoritos" });
  } else {
    return res.status(400).json({ error: "No se encontraron favoritos para el usuario" });
  }
});

module.exports = {
  getUserFavorites,
  addFavorite,
  deleteFavorite,
};