const Favorite = require("../models/Favorite");
const { AppError } = require("../middleware/error.middleware");
const { asyncHandler } = require("../middleware/error.middleware");
const { success } = require("../utils/response-formatter");
const { loadUserProducts, createListIfMissing } = require("../utils/user-product-list");

const sendFavorites = async (res, userId, message) => {
  const products = await loadUserProducts(Favorite, userId);
  res.status(200).json(success({ products }, message));
};

const getUserFavorites = asyncHandler(async (req, res, next) => {
  const requestedUserId = req.params.userId;
  const currentUserId = req.userId?.toString();
  const isAdmin = req.userRole === 'admin';

  // Validar que solo acceda a sus propios favoritos
  if (!isAdmin && currentUserId !== requestedUserId) {
    throw new AppError('Solo podés ver tus propios favoritos', 403, 'FORBIDDEN');
  }

  await sendFavorites(res, requestedUserId, "Favoritos");
});

const addFavorite = asyncHandler(async (req, res, next) => {
  const { productId } = req.body;
  const currentUserId = req.userId?.toString();

  // Siempre usar el usuario autenticado, no confiar en el body
  const userId = currentUserId;

  let existingFavorites = await Favorite.findOne({ userId });

  if (!existingFavorites) {
    const created = await createListIfMissing(Favorite, userId, { product: productId });
    if (created) {
      await sendFavorites(res, userId, "Se agregó en favoritos");
      return;
    }
    // A concurrent first add created the favorites: update them instead
    existingFavorites = await Favorite.findOne({ userId });
    if (!existingFavorites) {
      throw new AppError('No se pudo actualizar favoritos, intentá de nuevo', 409, 'CONCURRENT_UPDATE');
    }
  }

  const existingProduct = existingFavorites.products.find(
    (p) => p.product.toString() === productId
  );
  if (existingProduct) {
    throw new AppError("El producto ya está en favoritos", 400, "FAVORITE_ALREADY_EXISTS");
  }
  existingFavorites.products.push({ product: productId });
  await existingFavorites.save();

  await sendFavorites(res, userId, "Se agregó en favoritos");
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

  if (!existingFavorites) {
    throw new AppError("No se encontraron favoritos para el usuario", 400, "FAVORITES_NOT_FOUND");
  }

  existingFavorites.products = existingFavorites.products.filter(
    (p) => p.product.toString() !== productId
  );
  await existingFavorites.save();

  await sendFavorites(res, urlUserId, "Se eliminó de favoritos");
});

module.exports = {
  getUserFavorites,
  addFavorite,
  deleteFavorite,
};
