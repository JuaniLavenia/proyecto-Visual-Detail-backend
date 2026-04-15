const express = require("express");
const router = express.Router();
const {
  getUserCart,
  addToCart,
  removeFromCart,
} = require("../controllers/cart.controller");
const { body, param } = require("express-validator");
const { requestValidation } = require("../middleware/common.middleware");

// GET /cart/:userId - validate userId
router.get(
  "/cart/:userId",
  [
    param("userId")
      .notEmpty()
      .withMessage("User ID es requerido"),
  ],
  requestValidation,
  getUserCart
);

// POST /cart - validate cart data
router.post(
  "/cart",
  [
    body("userId")
      .notEmpty()
      .withMessage("User ID es requerido"),
    body("productId")
      .notEmpty()
      .withMessage("Product ID es requerido"),
    body("quantity")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Quantity debe ser un número positivo"),
  ],
  requestValidation,
  addToCart
);

// DELETE /cart/:userId/:productId - validate IDs
router.delete(
  "/cart/:userId/:productId",
  [
    param("userId")
      .notEmpty()
      .withMessage("User ID es requerido"),
    param("productId")
      .notEmpty()
      .withMessage("Product ID es requerido"),
  ],
  requestValidation,
  removeFromCart
);

module.exports = router;