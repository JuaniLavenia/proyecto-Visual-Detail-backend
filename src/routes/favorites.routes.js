const express = require("express");
const router = express.Router();
const {
  getUserFavorites,
  addFavorite,
  deleteFavorite,
} = require("../controllers/favorites.controller");
const { body, param } = require("express-validator");
const { requestValidation } = require("../middleware/common.middleware");
const { authenticate } = require("../middleware/auth.middleware");

// ========== RUTAS AUTENTICADAS ==========
// Todas requieren autenticación y solo pueden operar sobre el propio usuario

// GET /favorites/:userId - obtener favoritos del usuario
router.get(
  "/favorites/:userId",
  authenticate,
  [
    param("userId").notEmpty().withMessage("User ID es requerido"),
  ],
  requestValidation,
  getUserFavorites
);

// POST /favorites - agregar favorito
router.post(
  "/favorites",
  authenticate,
  [
    body("productId").notEmpty().withMessage("Product ID es requerido"),
  ],
  requestValidation,
  addFavorite
);

// DELETE /favorites/:userId/:productId - eliminar favorito
router.delete(
  "/favorites/:userId/:productId",
  authenticate,
  [
    param("userId").notEmpty().withMessage("User ID es requerido"),
    param("productId").notEmpty().withMessage("Product ID es requerido"),
  ],
  requestValidation,
  deleteFavorite
);

module.exports = router;