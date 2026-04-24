const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  postProduct,
  getProducts,
  getProductById,
  getStats,
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
const { authenticate } = require("../middleware/auth.middleware");
const { isAdmin } = require("../middleware/admin.middleware");

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

// ========== RUTAS PÚBLICAS ==========
// IMPORTANTE: rutas específicas ANTES de rutas con :id para evitar conflictos

// GET /productos - listar productos con paginación (público)
router.get(
  "/productos",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("Page debe ser un número positivo"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit debe estar entre 1 y 100"),
  ],
  requestValidation,
  getProducts
);

// GET /productos/search/:filter - búsqueda (público)
router.get("/productos/search/:filter", searchFilter);

// GET /productos/category/:filter - filtrar por categoría (público)
router.get("/productos/category/:filter", categoryFilter);

// GET /productos/brand/:filter - filtrar por marca (público)
router.get("/productos/brand/:filter", brandFilter);

// ========== RUTAS ADMIN (específicas, antes de /:id) ==========

// GET /productos/stats - estadísticas (admin)
router.get(
  "/productos/stats",
  authenticate,
  isAdmin,
  getStats
);

// GET /productos/export - exportar a XLSX (admin)
router.get(
  "/productos/export",
  authenticate,
  isAdmin,
  exportProducts
);

// POST /productos/bulk-upload - carga masiva desde Excel (admin)
router.post(
  "/productos/bulk-upload",
  authenticate,
  isAdmin,
  uploadExcel.single("file"),
  [
    body("file").notEmpty().withMessage("Archivo es requerido"),
  ],
  requestValidation,
  bulkUploadProducts
);

// POST /productos - crear producto (admin)
router.post(
  "/productos",
  authenticate,
  isAdmin,
  upload.single("image"),
  [
    body("name").optional().trim().notEmpty().withMessage("El nombre no puede estar vacío"),
    body("price").optional().isFloat({ min: 0 }).withMessage("El precio debe ser un número positivo"),
    body("stock").optional().isInt({ min: 0 }).withMessage("El stock debe ser un número entero"),
  ],
  requestValidation,
  postProduct
);

// ========== RUTAS CON PARÁMETRO :id (al final) ==========

// GET /productos/:id - detalle de producto (público)
router.get(
  "/productos/:id",
  [
    param("id").isMongoId().withMessage("ID de producto inválido"),
  ],
  requestValidation,
  getProductById
);

// PUT /productos/:id - actualizar producto (admin)
router.put(
  "/productos/:id",
  authenticate,
  isAdmin,
  upload.single("image"),
  [
    param("id").isMongoId().withMessage("ID de producto inválido"),
    body("name").optional().trim().notEmpty().withMessage("El nombre no puede estar vacío"),
    body("price").optional().isFloat({ min: 0 }).withMessage("El precio debe ser un número positivo"),
    body("stock").optional().isInt({ min: 0 }).withMessage("El stock debe ser un número entero"),
  ],
  requestValidation,
  updateProduct
);

// DELETE /productos/:id - eliminar producto (admin)
router.delete(
  "/productos/:id",
  authenticate,
  isAdmin,
  [
    param("id").isMongoId().withMessage("ID de producto inválido"),
  ],
  requestValidation,
  deleteProduct
);

module.exports = router;