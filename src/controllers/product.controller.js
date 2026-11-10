/**
 * Product Controller
 * Handles HTTP requests for product operations
 * Delegates to ProductService for business logic
 */

const productService = require("../services/product.service");
const { asyncHandler } = require("../middleware/error.middleware");
const { success, paginated } = require("../utils/response-formatter");
const { parseProductSheet, isSupportedSheetFile } = require("../utils/product-sheet");

const getProducts = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  // Already validated (strings, trimmed, length-capped) by the route.
  const { brand, category, search, sort, stock } = req.query;

  const result = await productService.findAll({ page, limit, brand, category, search, sort, stock });

  res.json(
    paginated(result.products, {
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      totalProducts: result.totalProducts,
    }),
  );
});

const getProductById = asyncHandler(async (req, res, next) => {
  const producto = await productService.findById(req.params.id);
  res.json(success(producto));
});

const getStats = asyncHandler(async (req, res, next) => {
  const stats = await productService.getStats();
  res.json(success(stats));
});

// El form de admin manda la URL de la imagen como "imageUrl", pero el
// modelo/servicio usan "image". Sin este mapeo el valor nunca llega a
// guardarse (ver src/models/Product.js).
const mapImageUrl = (body) => {
  if (body?.imageUrl && !body.image) {
    return { ...body, image: body.imageUrl };
  }
  return body;
};

const postProduct = asyncHandler(async (req, res, next) => {
  const producto = await productService.create(mapImageUrl(req.body));
  res.status(201).json(success(producto, "Producto creado"));
});

const updateProduct = asyncHandler(async (req, res, next) => {
  const producto = await productService.update(req.params.id, mapImageUrl(req.body));
  res.json(success(producto, "Producto actualizado"));
});

const deleteProduct = asyncHandler(async (req, res, next) => {
  await productService.delete(req.params.id);
  res.json(success(null, "Producto eliminado"));
});

// Bulk-upload failures carry the per-row list so the admin can fix the sheet
const sheetError = (res, code, message, details) =>
  res.status(400).json({
    success: false,
    error: { message, code, ...(details && { details }) },
  });

// "upsert" (default) adds or updates products; "replace" swaps the whole
// catalog for the sheet. Both are all or nothing.
const IMPORT_MODES = ["upsert", "replace"];

const bulkUploadProducts = asyncHandler(async (req, res, next) => {
  const mode = req.body?.mode || "upsert";
  if (!IMPORT_MODES.includes(mode)) {
    return sheetError(res, "INVALID_MODE", 'Modo de importación inválido. Usá "upsert" o "replace"');
  }

  const { originalname, buffer } = req.file;
  if (!isSupportedSheetFile(originalname)) {
    return sheetError(res, "INVALID_FILE_TYPE", "Formato no soportado. Subí un archivo .xlsx, .xls o .csv");
  }

  const { rows, headers, errors } = parseProductSheet(buffer, originalname);
  const rejected =
    mode === "replace"
      ? "La planilla tiene errores. No se modificó el catálogo."
      : "La planilla tiene errores. No se importó ningún producto.";

  // All or nothing: one bad row rejects the file so nothing half-imports
  if (errors.length > 0) {
    return sheetError(res, "INVALID_SHEET", rejected, errors);
  }
  if (rows.length === 0) {
    return sheetError(res, "INVALID_SHEET", "La planilla no tiene productos debajo de los encabezados.", []);
  }

  if (mode === "replace") {
    const resultado = await productService.replaceCatalog(rows, headers);
    if (resultado.errors.length > 0) {
      return sheetError(res, "INVALID_SHEET", rejected, resultado.errors);
    }
    return res.json(
      success({
        message: `Catálogo reemplazado: ${resultado.deleted} productos eliminados, ${resultado.inserted} cargados`,
        modo: "replace",
        total: resultado.total,
        eliminados: resultado.deleted,
        nuevos: resultado.inserted,
      }),
    );
  }

  // Checks brands, categories and duplicates against the catalog; writes
  // nothing when any row fails
  const resultado = await productService.bulkUpsert(rows, headers);
  if (resultado.errors.length > 0) {
    return sheetError(res, "INVALID_SHEET", rejected, resultado.errors);
  }
  // matchedCount already includes modifiedCount: adding both double-counts updates
  const exitosos = resultado.upserted + resultado.matched;

  res.json(
    success({
      message: `Productos cargados/reemplazados (${exitosos} exitosos)`,
      modo: "upsert",
      total: resultado.total,
      exitosos,
      nuevos: resultado.upserted,
      actualizados: resultado.modified,
    }),
  );
});

const exportProducts = asyncHandler(async (req, res, next) => {
  const XLSX = require("xlsx");

  // Get all products
  const productos = await productService.findAll({ page: 1, limit: 10000 });

  // Prepare data for Excel with human-readable column names
  // These names match the import headers (utils/product-sheet.js) so the file can be re-imported
  const data = productos.products.map((p) => ({
    nombre: p.name,
    descripcion: p.description || "",
    imagen: p.image || "",
    precio: p.price,
    precioMayorista: p.precioMayorista ?? "",
    stock: p.stock,
    categoria: p.category,
    capacidad: p.capacity,
    marca: p.brand || "",
  }));

  if (data.length === 0) {
    return res.status(400).json(
      success({ message: 'No hay productos para exportar' })
    );
  }

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-size columns
  const colWidths = Object.keys(data[0]).map((key) => ({
    wch: Math.max(
      key.length,
      ...data.map((row) => String(row[key] || "").length),
    ),
  }));
  worksheet["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");

  // Set headers for download
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=productos-visual-detail.xlsx",
  );

  // Send file
  const buffer = XLSX.write(workbook, { type: "buffer" });
  res.send(buffer);
});

module.exports = {
  getProducts,
  getProductById,
  getStats,
  postProduct,
  updateProduct,
  deleteProduct,
  bulkUploadProducts,
  exportProducts,
};
