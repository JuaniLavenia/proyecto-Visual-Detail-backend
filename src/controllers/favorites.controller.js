const Favorite = require("../models/Favorite");

const getUserFavorites = async (req, res) => {
  try {
    const userId = req.params.userId;
    const favorites = await Favorite.findOne({ userId }).populate(
      "products.product"
    );
    res.status(200).json({ message: "Favoritos", data: favorites });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al obtener los favoritos del usuario" });
  }
};

const addFavorite = async (req, res) => {
  try {
    const { userId, productId } = req.body;
    const existingFavorites = await Favorite.findOne({ userId });

    if (existingFavorites) {
      const existingProduct = existingFavorites.products.find(
        (p) => p.product.toString() === productId
      );
      if (!existingProduct) {
        existingFavorites.products.push({ product: productId });
        await existingFavorites.save();
        res.status(200).json({ message: "Se agregó en favoritos" });
      } else {
        res.status(400).json({ error: "El producto ya está en favoritos" });
      }
    } else {
      const newFavorite = new Favorite({
        userId,
        products: [{ product: productId }],
      });
      await newFavorite.save();
      res.status(200).json({ message: "Se agregó en favoritos" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error al agregar el favorito" });
  }
};

const deleteFavorite = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    const existingFavorites = await Favorite.findOne({ userId });

    if (existingFavorites) {
      existingFavorites.products = existingFavorites.products.filter(
        (p) => p.product.toString() !== productId
      );
      await existingFavorites.save();
      res.status(200).json({ message: "Se eliminó de favoritos" });
    } else {
      res
        .status(400)
        .json({ error: "No se encontraron favoritos para el usuario" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar el favorito" });
  }
};

module.exports = {
  getUserFavorites,
  addFavorite,
  deleteFavorite,
};
