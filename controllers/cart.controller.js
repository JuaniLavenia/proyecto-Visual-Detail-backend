const CartItem = require("../models/Cart");

const getUserCart = async (req, res) => {
  try {
    const userId = req.params.userId;
    const cartItems = await CartItem.findOne({ userId }).populate(
      "products.product"
    );

    res.status(200).json({ message: "Carrito", data: cartItems });
  } catch (error) {
    res.status(500).json({
      error: "Error al obtener los elementos del carrito del usuario",
    });
  }
};

const addToCart = async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;
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

    res.status(200).json({ message: "Se agrego/modifico en el carrito" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al agregar el elemento al carrito" });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    const existingCartItem = await CartItem.findOne({ userId });

    if (existingCartItem) {
      existingCartItem.products = existingCartItem.products.filter(
        (p) => p.product.toString() !== productId
      );
      await existingCartItem.save();
    }

    res.status(200).json({ message: "Se elimino del carrito" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al eliminar el elemento del carrito" });
  }
};

module.exports = {
  getUserCart,
  addToCart,
  removeFromCart,
};
