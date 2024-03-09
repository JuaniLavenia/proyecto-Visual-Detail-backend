const express = require("express");
const router = express.Router();
const {
  getUserCart,
  addToCart,
  removeFromCart,
} = require("../controllers/cart.controller");

router.get("/cart/:userId", getUserCart);
router.post("/cart", addToCart);
router.delete("/cart/:userId/:productId", removeFromCart);

module.exports = router;
