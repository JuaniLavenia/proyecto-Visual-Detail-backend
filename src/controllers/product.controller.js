/**
 * Product Controller
 * Handles HTTP requests for product operations
 * Delegates to ProductService for business logic
 */

const productService = require("../services/product.service");
const { asyncHandler } = require("../middleware/error.middleware");
const { success, paginated } = require("../utils/response-formatter");

/**
 * Column mapping for bulk upload
 * Maps various column names (Spanish, English, variants) to MongoDB field names
 */
const COLUMN_MAP = {
  // Name variations
  name: ['name', 'nombre', 'producto', 'product', 'titulo', 'title', 'denominacion'],
  // Description
  description: ['description', 'descripcion', 'desc', 'detalle', 'details', 'detalles'],
  // Image URL
  image: ['image', 'imagen', 'foto', 'photo', 'url_imagen', 'url_imagen', 'imagen_url'],
  // Price
  price: ['price', 'precio', 'cost', 'costo', 'valor'],
  // Wholesale price
  precioMayorista: ['precioMayorista', 'precio_mayorista', 'mayorista', 'wholesale', 'wholesalePrice', 'precio mayorista'],
  // Stock
  stock: ['stock', 'cantidad', 'quantity', 'disponible', 'available'],
  // Capacity
  capacity: ['capacity', 'capacidad', 'volumen', 'volume', 'size', 'tamanio', 'tamano'],
  // Category
  category: ['category', 'categoria', 'cat', 'tipo', 'type', 'clase'],
  // Brand
  brand: ['brand', 'marca', 'fabricante', 'manufacturer', 'marca_comercial'],
};

/**
 * Normalize column names from Excel to MongoDB format
 * @param {Object} row - Raw row from Excel
 * @returns {Object} - Normalized row with MongoDB field names
 */
const normalizeRow = (row) => {
  const normalized = {};
  
  for (const [mongoField, possibleNames] of Object.entries(COLUMN_MAP)) {
    // Try to find the value using any of the possible column names
    for (const possibleName of possibleNames) {
      // Check exact match (case-insensitive)
      const exactMatch = Object.keys(row).find(
        k => k.toLowerCase().trim() === possibleName.toLowerCase()
      );
      if (exactMatch && row[exactMatch] !== undefined && row[exactMatch] !== '') {
        normalized[mongoField] = row[exactMatch];
        break;
      }
    }
  }
  
  return normalized;
};

const getProducts = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const result = await productService.findAll({ page, limit });

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

const postProduct = asyncHandler(async (req, res, next) => {
  const producto = await productService.create(req.body);
  res.status(201).json(success(producto, "Producto creado"));
});

const updateProduct = asyncHandler(async (req, res, next) => {
  const producto = await productService.update(req.params.id, req.body);
  res.json(success(producto, "Producto actualizado"));
});

const deleteProduct = asyncHandler(async (req, res, next) => {
  await productService.delete(req.params.id);
  res.json(success(null, "Producto eliminado"));
});

const searchFilter = asyncHandler(async (req, res, next) => {
  const { filter } = req.params;
  const productos = await productService.search(filter);
  res.json(success(productos));
});

const categoryFilter = asyncHandler(async (req, res, next) => {
  const { filter } = req.params;
  const productos = await productService.filterByCategory(filter);
  res.json(success(productos));
});

const brandFilter = asyncHandler(async (req, res, next) => {
  const { filter } = req.params;
  const productos = await productService.filterByBrand(filter);
  res.json(success(productos));
});

const bulkUploadProducts = asyncHandler(async (req, res, next) => {
  const XLSX = require("xlsx");
  const buffer = req.file.buffer;
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // Normalize column names to MongoDB format
  const data = rawData.map(row => normalizeRow(row));

  // Filter out rows that don't have at least the required fields
  const validData = data.filter(row => row.name && (row.price !== undefined) && row.stock !== undefined);

  if (validData.length === 0) {
    return res.status(400).json(
      success({
        message: 'No se encontraron productos válidos en el archivo. Asegúrate de tener columnas: nombre, precio, stock',
        productos: [],
      })
    );
  }

  const resultados = await productService.bulkUpsert(validData);

  res.json(
    success({
      message: `Productos cargados/reemplazados (${resultados.length} exitosos)`,
      productos: resultados,
      total: validData.length,
      exitosos: resultados.length,
    }),
  );
});

const exportProducts = asyncHandler(async (req, res, next) => {
  const XLSX = require("xlsx");

  // Get all products
  const productos = await productService.findAll({ page: 1, limit: 10000 });

  // Prepare data for Excel with human-readable column names
  // These names match the COLUMN_MAP so the file can be re-imported
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
  searchFilter,
  categoryFilter,
  brandFilter,
  bulkUploadProducts,
  exportProducts,
};
