const express = require("express");
const router = express.Router();
const {
  getUserFavorites,
  addFavorite,
  deleteFavorite,
} = require("../controllers/favorites.controller");

router.get("/favorites/:userId", getUserFavorites);
router.post("/favorites", addFavorite);
router.delete("/favorites/:userId/:productId", deleteFavorite);

module.exports = router;
