/**
 * Product Service
 * Handles product CRUD operations
 */

const Producto = require('../models/Product');
const ProductBrand = require('../models/Brand');
const ProductCategory = require('../models/Category');
const { sanitizeUpdateQuery, sanitizeSort, sanitizeProjection } = require('../utils/query-sanitizer');
const { AppError } = require('../middleware/error.middleware');
const { normalizeName } = require('../utils/normalize-name');
const { withTransaction } = require('../utils/with-transaction');
const {
  buildSort,
  buildProductFilter,
  resolveTaxonomyName,
} = require('./product-query');

// Un check de truthy trata "" y 0 igual que undefined, permitiendo que
// esos valores salteen la validacion de taxonomia. Esto exige explicitamente
// un string no vacio.
const hasTaxonomyValue = (value) => typeof value === 'string' && value.trim().length > 0;

const normalizeTaxonomyLookup = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

const normalizeTaxonomyValue = (value, taxonomyEntry = null) => {
  if (typeof value !== 'string') {
    return taxonomyEntry?.name || '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return taxonomyEntry?.name || '';
  }

  if (taxonomyEntry && typeof taxonomyEntry.name === 'string' && taxonomyEntry.name.trim()) {
    return taxonomyEntry.name.trim();
  }

  return trimmed;
};

const validateTaxonomySelection = (type, value, catalog = []) => {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  if (!normalizedValue) {
    throw new AppError(`${type === 'brand' ? 'La marca' : 'La categoría'} es requerida`, 400, 'TAXONOMY_REQUIRED');
  }

  const match = catalog.find((entry) => {
    if (!entry || !entry.isActive) return false;
    const candidateName = typeof entry.name === 'string' ? entry.name.trim() : '';
    const candidateSlug = typeof entry.slug === 'string' ? entry.slug.trim() : '';
    const lookupValue = normalizeTaxonomyLookup(normalizedValue);
    return (
      normalizeTaxonomyLookup(candidateName) === lookupValue ||
      normalizeTaxonomyLookup(candidateSlug) === lookupValue
    );
  });

  if (!match) {
    const label = type === 'brand' ? 'Marca' : 'Categoría';
    throw new AppError(`${label} no existe o no está activa`, 400, 'TAXONOMY_INVALID');
  }

  return normalizeTaxonomyValue(normalizedValue, match);
};

// The spreadsheet import, like create/update from the admin, only accepts
// brands and categories that already exist and are active: a typo in the
// sheet becomes a row error instead of a new (junk) taxonomy entry.
const findActiveTaxonomyName = (value, catalog) => {
  const lookupValue = normalizeTaxonomyLookup(value);
  const match = catalog.find(
    (entry) =>
      entry?.isActive &&
      (normalizeTaxonomyLookup(entry.name) === lookupValue ||
        normalizeTaxonomyLookup(entry.slug) === lookupValue)
  );
  return match ? match.name.trim() : null;
};

// What makes two products "the same" on import: name + capacity + brand,
// ignoring case, accents and repeated spaces ("500 ml" equals "500ml").
// Category is not part of it, so moving a product to another category
// updates it instead of creating a copy.
const productIdentity = ({ name, capacity, brand }) =>
  [
    normalizeTaxonomyLookup(name),
    normalizeTaxonomyLookup(capacity).replace(/\s+/g, ''),
    normalizeTaxonomyLookup(brand),
  ].join('|');

const IMPORT_FIELDS = ['name', 'description', 'image', 'category', 'price', 'precioMayorista', 'stock', 'capacity', 'brand'];
const IMPORT_COLUMN_LABELS = { name: 'nombre', category: 'categoria', brand: 'marca' };

// Name normalization lives here (not as a schema setter) because update
// and bulkWrite/replaceOne do not run setters on every path.
const applyNormalizedName = (data) => {
  if (data.name !== undefined) {
    data.name = normalizeName(data.name);
  }
};

class ProductService {
  /**
   * Get all products with pagination.
   * brand/category accept a slug or a name and are resolved to the
   * canonical name stored on Product; search matches name (escaped,
   * case-insensitive); sort and stock (`in` / `out`) are fixed keys in
   * product-query.
   */
  async findAll({ page = 1, limit = 10, brand, category, search, sort, stock } = {}) {
    const skip = (page - 1) * limit;

    const [brandName, categoryName] = await Promise.all([
      brand ? resolveTaxonomyName(ProductBrand, brand) : Promise.resolve(undefined),
      category ? resolveTaxonomyName(ProductCategory, category) : Promise.resolve(undefined),
    ]);

    // A filter that does not match any brand/category cannot match any
    // product: answer with an empty page instead of an error.
    if (brandName === null || categoryName === null) {
      return { products: [], currentPage: page, totalPages: 0, totalProducts: 0 };
    }

    // Built from fixed keys and checked strings; see buildProductFilter for
    // why it skips sanitizeFindQuery.
    const filter = buildProductFilter({ brand: brandName, category: categoryName, search, stock });
    const sanitizedSort = sanitizeSort(buildSort(sort));
    const sanitizedProjection = sanitizeProjection({ __v: 0 });

    const [productos, total] = await Promise.all([
      Producto.find(filter)
        .select(sanitizedProjection)
        .sort(sanitizedSort)
        .skip(skip)
        .limit(limit),
      Producto.countDocuments(filter)
    ]);

    return {
      products: productos,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalProducts: total
    };
  }

  /**
   * Get product stats using MongoDB aggregation
   */
  async getStats() {
    const stats = await Producto.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          inStock: {
            $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] }
          },
          outOfStock: {
            $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] }
          },
          totalStockValue: {
            $sum: { $multiply: ['$price', '$stock'] }
          },
        }
      }
    ]);

    if (stats.length === 0) {
      return {
        totalProducts: 0,
        inStock: 0,
        outOfStock: 0,
        totalStockValue: 0,
      };
    }

    return stats[0];
  }

  /**
   * Get product by ID
   */
  async findById(id) {
    const producto = await Producto.findById(id);
    if (!producto) {
      throw new AppError('Producto no encontrado', 404, 'PRODUCT_NOT_FOUND');
    }
    return producto;
  }

  /**
   * Create product
   */
  async create(productData) {
    const allowedFields = ['name', 'description', 'image', 'category', 'price', 'precioMayorista', 'stock', 'capacity', 'brand'];
    const sanitizedData = {};

    for (const field of allowedFields) {
      if (productData[field] !== undefined) {
        sanitizedData[field] = productData[field];
      }
    }

    applyNormalizedName(sanitizedData);

    const hasBrand = hasTaxonomyValue(sanitizedData.brand);
    const hasCategory = hasTaxonomyValue(sanitizedData.category);

    const [existingBrands, existingCategories] = await Promise.all([
      hasBrand ? ProductBrand.find({ isActive: true }).lean() : Promise.resolve(null),
      hasCategory ? ProductCategory.find({ isActive: true }).lean() : Promise.resolve(null),
    ]);

    if (hasBrand) {
      sanitizedData.brand = validateTaxonomySelection('brand', sanitizedData.brand, existingBrands);
    }

    if (hasCategory) {
      sanitizedData.category = validateTaxonomySelection('category', sanitizedData.category, existingCategories);
    }

    const producto = new Producto(sanitizedData);
    return await producto.save();
  }

  /**
   * Update product
   */
  async update(id, updateData) {
    const allowedFields = ['name', 'description', 'image', 'category', 'price', 'precioMayorista', 'stock', 'capacity', 'brand'];
    const sanitizedData = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        sanitizedData[field] = updateData[field];
      }
    }

    applyNormalizedName(sanitizedData);

    const current = await Producto.findById(id).lean();
    if (!current) {
      throw new AppError('Producto no encontrado', 404, 'PRODUCT_NOT_FOUND');
    }

    // El formulario de edicion reenvia brand/category en cada submit aunque
    // el admin solo haya tocado otro campo. Revalidar solo cuando el valor
    // realmente cambia evita que una marca/categoria desactivada o
    // renombrada despues de creado el producto bloquee ediciones que ni
    // siquiera la tocan.
    const brandChanged =
      hasTaxonomyValue(sanitizedData.brand) &&
      normalizeTaxonomyLookup(sanitizedData.brand) !== normalizeTaxonomyLookup(current.brand);
    const categoryChanged =
      hasTaxonomyValue(sanitizedData.category) &&
      normalizeTaxonomyLookup(sanitizedData.category) !== normalizeTaxonomyLookup(current.category);

    const [existingBrands, existingCategories] = await Promise.all([
      brandChanged ? ProductBrand.find({ isActive: true }).lean() : Promise.resolve(null),
      categoryChanged ? ProductCategory.find({ isActive: true }).lean() : Promise.resolve(null),
    ]);

    if (brandChanged) {
      sanitizedData.brand = validateTaxonomySelection('brand', sanitizedData.brand, existingBrands);
    } else if (hasTaxonomyValue(sanitizedData.brand)) {
      // Mismo valor de siempre: no lo tocamos, se mantiene el guardado.
      delete sanitizedData.brand;
    }

    if (categoryChanged) {
      sanitizedData.category = validateTaxonomySelection('category', sanitizedData.category, existingCategories);
    } else if (hasTaxonomyValue(sanitizedData.category)) {
      delete sanitizedData.category;
    }

    const sanitizedUpdate = sanitizeUpdateQuery({ $set: sanitizedData });

    const producto = await Producto.findByIdAndUpdate(
      id,
      sanitizedUpdate,
      { new: true, runValidators: true }
    );

    if (!producto) {
      throw new AppError('Producto no encontrado', 404, 'PRODUCT_NOT_FOUND');
    }

    return producto;
  }

  /**
   * Delete product
   */
  async delete(id) {
    const producto = await Producto.findByIdAndDelete(id);
    if (!producto) {
      throw new AppError('Producto no encontrado', 404, 'PRODUCT_NOT_FOUND');
    }
    return true;
  }

  /**
   * Imports spreadsheet rows (from utils/product-sheet.js) all or nothing:
   * matching products (see productIdentity) are replaced, new ones inserted.
   * Any row error means nothing is written.
   *
   * @param {Array<{row: number, data: object}>} rows
   * @param {Object<string, string>} headers - field -> header text, for messages
   * @returns {Promise<{errors: Array<{row, column, message}>, total?, upserted?, modified?, matched?}>}
   */
  async bulkUpsert(rows, headers = {}) {
    const { errors, operations } = await planUpsert(rows, headers);

    if (errors.length > 0) return { errors };
    if (operations.length === 0) {
      return { errors: [], total: 0, upserted: 0, modified: 0, matched: 0 };
    }

    // One round-trip to Atlas: a write per row used to exceed the client timeout
    const result = await Producto.bulkWrite(operations);

    return {
      errors: [],
      total: operations.length,
      upserted: result.insertedCount,
      modified: result.modifiedCount,
      matched: result.matchedCount,
    };
  }

  /**
   * Replaces the whole catalog with the sheet: every row is checked first
   * (same rules as bulkUpsert, minus matching stored products), and only a
   * fully valid, non-empty sheet deletes all products and inserts the new
   * ones, in one transaction so a failed insert restores the old catalog.
   * Orders keep their own copy of name and price; carts and favorites
   * already skip products that no longer exist.
   *
   * @returns {Promise<{errors: Array<{row, column, message}>, total?, deleted?, inserted?}>}
   */
  async replaceCatalog(rows, headers = {}) {
    if (rows.length === 0) {
      return {
        errors: [{ row: null, column: null, message: 'La planilla no tiene productos. El catálogo no se modificó.' }],
      };
    }

    const { errors, products } = checkImportRows(rows, headers, await loadImportCatalogs());
    if (errors.length > 0) return { errors };

    const documents = products.map(({ product }) => product);
    const { deletedCount } = await withTransaction(Producto, async (session) => {
      const deleted = await Producto.deleteMany({}, { session });
      await Producto.insertMany(documents, { session });
      return deleted;
    });

    return { errors: [], total: documents.length, deleted: deletedCount, inserted: documents.length };
  }

  /**
   * The catalog checks of an import (brand/category, duplicate rows and, for
   * an upsert, rows matching several stored products) without writing, so a
   * sheet with format errors can report every problem at once.
   *
   * @param {'upsert'|'replace'} mode
   * @returns {Promise<Array<{row, column, message}>>}
   */
  async checkImport(rows, headers = {}, mode = 'upsert') {
    if (mode === 'replace') {
      return checkImportRows(rows, headers, await loadImportCatalogs()).errors;
    }
    return (await planUpsert(rows, headers)).errors;
  }
}

// Checks the rows and turns them into bulkWrite operations: a row matching
// one stored product replaces it, a new one is inserted, and a row matching
// several stored products (existing duplicates) is an error.
const planUpsert = async (rows, headers) => {
  const [catalogs, existing] = await Promise.all([
    loadImportCatalogs(),
    Producto.find({}, { name: 1, capacity: 1, brand: 1 }).lean(),
  ]);

  const storedByIdentity = new Map();
  for (const product of existing) {
    const key = productIdentity(product);
    storedByIdentity.set(key, [...(storedByIdentity.get(key) || []), product._id]);
  }

  const { errors, products } = checkImportRows(rows, headers, catalogs);
  const operations = [];

  for (const { row, key, product } of products) {
    const matches = storedByIdentity.get(key) || [];
    if (matches.length > 1) {
      errors.push({
        row,
        column: importColumn(headers, 'name'),
        message: `Coincide con ${matches.length} productos que ya están cargados (están duplicados). Borrá los repetidos o usá "Reemplazar catálogo"`,
      });
      continue;
    }

    // The sheet is the source of truth for the row: replacing keeps the
    // product _id (carts, favorites and orders keep pointing at it)
    operations.push(
      matches.length === 1
        ? { replaceOne: { filter: { _id: matches[0] }, replacement: product } }
        : { insertOne: { document: product } }
    );
  }

  return { errors, operations };
};

// Helper functions at module level
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item));
  if (typeof obj !== 'object') return obj;
  
  const sanitized = {};
  for (const key in obj) {
    if (key.startsWith('$')) continue;
    sanitized[key] = sanitizeObject(obj[key]);
  }
  return sanitized;
};

const importColumn = (headers, field) => headers[field] || IMPORT_COLUMN_LABELS[field];

const loadImportCatalogs = async () => {
  const [brands, categories] = await Promise.all([
    ProductBrand.find({}).lean(),
    ProductCategory.find({}).lean(),
  ]);
  return { brands, categories };
};

// Checks each row on its own and against the rest of the sheet: brand and
// category must be active (stored with their canonical name) and no two rows
// may be the same product. Returns the clean product documents of the rows
// that passed, with their identity key.
const checkImportRows = (rows, headers, { brands, categories }) => {
  const errors = [];
  const products = [];
  const rowByIdentity = new Map();

  for (const { row, data } of rows) {
    const product = {};
    for (const field of IMPORT_FIELDS) {
      if (data[field] !== undefined) product[field] = data[field];
    }
    const sanitized = sanitizeObject(product);
    applyNormalizedName(sanitized);

    let valid = true;
    const checks = [
      ['category', 'La categoría', categories],
      ['brand', 'La marca', brands],
    ];
    for (const [field, label, catalog] of checks) {
      if (!hasTaxonomyValue(sanitized[field])) continue;
      const name = findActiveTaxonomyName(sanitized[field], catalog);
      if (name) {
        sanitized[field] = name;
      } else {
        errors.push({
          row,
          column: importColumn(headers, field),
          message: `${label} "${sanitized[field].trim()}" no existe o no está activa. Creala en el admin o corregí la planilla`,
        });
        valid = false;
      }
    }
    if (!valid) continue;

    const key = productIdentity(sanitized);
    if (rowByIdentity.has(key)) {
      errors.push({
        row,
        column: importColumn(headers, 'name'),
        message: `Es el mismo producto que la fila ${rowByIdentity.get(key)} (mismo nombre, capacidad y marca)`,
      });
      continue;
    }
    rowByIdentity.set(key, row);
    products.push({ row, key, product: sanitized });
  }

  return { errors, products };
};

module.exports = Object.assign(new ProductService(), {
  normalizeTaxonomyValue,
  validateTaxonomySelection,
  normalizeTaxonomyLookup,
});