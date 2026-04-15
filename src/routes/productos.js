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
  bulkUploadProducts,
  exportProducts,
} = require("../controllers/product.controller");
const { body, param, query } = require("express-validator");
const { requestValidation } = require("../middleware/common.middleware");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/img/productos");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });
const uploadExcel = multer({ storage: multer.memoryStorage() });

// GET /productos - with pagination validation
router.get(
  "/productos",
  [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page debe ser un número positivo"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit debe estar entre 1 y 100"),
  ],
  requestValidation,
  getProducts
);

// GET /productos/export - export all products to XLSX (debe estar ANTES de :id)
router.get("/productos/export", exportProducts);

// GET /productos/:id - validate MongoDB ID
router.get(
  "/productos/:id",
  [
    param("id")
      .isMongoId()
      .withMessage("ID de producto inválido"),
  ],
  requestValidation,
  getProductById
);

// POST /productos - validate product fields
router.post(
  "/productos",
  upload.single("image"),
  [
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("El nombre no puede estar vacío"),
    body("price")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("El precio debe ser un número positivo"),
    body("stock")
      .optional()
      .isInt({ min: 0 })
      .withMessage("El stock debe ser un número entero"),
  ],
  requestValidation,
  postProduct
);

// PUT /productos/:id - validate ID and fields
router.put(
  "/productos/:id",
  upload.single("image"),
  [
    param("id")
      .isMongoId()
      .withMessage("ID de producto inválido"),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("El nombre no puede estar vacío"),
    body("price")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("El precio debe ser un número positivo"),
    body("stock")
      .optional()
      .isInt({ min: 0 })
      .withMessage("El stock debe ser un número entero"),
  ],
  requestValidation,
  updateProduct
);

// DELETE /productos/:id - validate ID
router.delete(
  "/productos/:id",
  [
    param("id")
      .isMongoId()
      .withMessage("ID de producto inválido"),
  ],
  requestValidation,
  deleteProduct
);

// GET /productos/search/:filter - no validation needed (string filter)
router.get("/productos/search/:filter", searchFilter);

// GET /productos/category/:filter - no validation needed
router.get("/productos/category/:filter", categoryFilter);

// GET /productos/brand/:filter - no validation needed
router.get("/productos/brand/:filter", brandFilter);

// POST /productos/bulk-upload - validate file presence
router.post(
  "/productos/bulk-upload",
  uploadExcel.single("file"),
  [
    body("file")
      .notEmpty()
      .withMessage("Archivo es requerido"),
  ],
  requestValidation,
  bulkUploadProducts
);

// GET /productos/export - export all products to XLSX
router.get("/productos/export", exportProducts);

module.exports = router;