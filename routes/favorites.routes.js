const express = require("express");
const router = express.Router();
const {
  getUserFavorites,
  addFavorite,
  deleteFavorite,
} = require("../controllers/favorites.controller");
const { body, param } = require("express-validator");
const { requestValidation } = require("../middlewares/common.middleware");

// GET /favorites/:userId - validate userId
router.get(
  "/favorites/:userId",
  [
    param("userId")
      .notEmpty()
      .withMessage("User ID es requerido"),
  ],
  requestValidation,
  getUserFavorites
);

// POST /favorites - validate favorite data
router.post(
  "/favorites",
  [
    body("userId")
      .notEmpty()
      .withMessage("User ID es requerido"),
    body("productId")
      .notEmpty()
      .withMessage("Product ID es requerido"),
  ],
  requestValidation,
  addFavorite
);

// DELETE /favorites/:userId/:productId - validate IDs
router.delete(
  "/favorites/:userId/:productId",
  [
    param("userId")
      .notEmpty()
      .withMessage("User ID es requerido"),
    param("productId")
      .notEmpty()
      .withMessage("Product ID es requerido"),
  ],
  requestValidation,
  deleteFavorite
);

module.exports = router;