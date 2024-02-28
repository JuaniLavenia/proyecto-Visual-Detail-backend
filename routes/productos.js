const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  postProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  searchFilter,
  categoryFilter,
  brandFilter,
} = require("../controllers/product.controller");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/img/productos");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

router.get("/productos", getProducts);

router.get("/productos/:id", getProductById);

router.post("/productos", upload.single("image"), postProduct);

router.put("/productos/:id", upload.single("image"), updateProduct);

router.delete("/productos/:id", deleteProduct);

router.get("/productos/search/:filter", searchFilter);

router.get("/productos/category/:filter", categoryFilter);

router.get("/productos/brand/:filter", brandFilter);

module.exports = router;
