const express = require("express");
const router = express.Router();
const {
  getUserCart,
  addToCart,
  removeFromCart,
} = require("../controllers/cart.controller");
const { body, param } = require("express-validator");
const { requestValidation } = require("../middleware/common.middleware");
const { authenticate } = require("../middleware/auth.middleware");

// ========== RUTAS AUTENTICADAS ==========
// Todas requieren autenticación y solo pueden operar sobre el propio usuario

// GET /cart/:userId - obtener carrito del usuario
router.get(
  "/cart/:userId",
  authenticate,
  [
    param("userId").notEmpty().withMessage("User ID es requerido"),
  ],
  requestValidation,
  getUserCart
);

// POST /cart - agregar al carrito
router.post(
  "/cart",
  authenticate,
  [
    body("productId").notEmpty().withMessage("Product ID es requerido"),
    body("quantity").optional().isInt({ min: 1 }).withMessage("Quantity debe ser un número positivo"),
  ],
  requestValidation,
  addToCart
);

// DELETE /cart/:userId/:productId - eliminar del carrito
router.delete(
  "/cart/:userId/:productId",
  authenticate,
  [
    param("userId").notEmpty().withMessage("User ID es requerido"),
    param("productId").notEmpty().withMessage("Product ID es requerido"),
  ],
  requestValidation,
  removeFromCart
);

module.exports = router;