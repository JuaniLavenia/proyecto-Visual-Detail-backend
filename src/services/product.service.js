/**
 * Product Service
 * Handles product CRUD operations
 */

const Producto = require('../models/Product');
const { sanitizeFindQuery, sanitizeUpdateQuery, sanitizeSort, sanitizeProjection } = require('../utils/query-sanitizer');
const { AppError } = require('../middleware/error.middleware');

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

const taxonomyPatternFromValue = (value) => {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '';

  const accentGroups = {
    a: '[aáàäâ]',
    e: '[eéèëê]',
    i: '[iíìïî]',
    o: '[oóòöô]',
    u: '[uúùüû]',
    n: '[nñ]',
    c: '[cç]',
  };

  return Array.from(rawValue.toLowerCase())
    .map((char) => {
      const normalizedChar = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (char === ' ' || char === '_' || char === '-') return '[\\s_-]+';
      if (accentGroups[normalizedChar]) return accentGroups[normalizedChar];
      return normalizedChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
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

class ProductService {
  /**
   * Get all products with pagination
   */
  async findAll({ page = 1, limit = 10 }) {
    const skip = (page - 1) * limit;
    
    const sanitizedQuery = sanitizeFindQuery({});
    const sanitizedSort = sanitizeSort({ createdAt: -1 });
    const sanitizedProjection = sanitizeProjection({ __v: 0 });
    
    const [productos, total] = await Promise.all([
      Producto.find(sanitizedQuery)
        .select(sanitizedProjection)
        .sort(sanitizedSort)
        .skip(skip)
        .limit(limit),
      Producto.countDocuments(sanitizedQuery)
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

    const ProductBrand = require('../models/Brand');
    const ProductCategory = require('../models/Category');

    if (sanitizedData.brand) {
      const existingBrands = await ProductBrand.find({ isActive: true }).lean();
      sanitizedData.brand = validateTaxonomySelection('brand', sanitizedData.brand, existingBrands);
    }

    if (sanitizedData.category) {
      const existingCategories = await ProductCategory.find({ isActive: true }).lean();
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

    const ProductBrand = require('../models/Brand');
    const ProductCategory = require('../models/Category');

    if (sanitizedData.brand) {
      const existingBrands = await ProductBrand.find({ isActive: true }).lean();
      sanitizedData.brand = validateTaxonomySelection('brand', sanitizedData.brand, existingBrands);
    }

    if (sanitizedData.category) {
      const existingCategories = await ProductCategory.find({ isActive: true }).lean();
      sanitizedData.category = validateTaxonomySelection('category', sanitizedData.category, existingCategories);
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
   * Search products by name
   */
  async search(filter) {
    const sanitizedFilter = sanitizeValue(filter);
    const query = {
      name: { $regex: sanitizedFilter, $options: 'i' }
    };
    const sanitizedQuery = sanitizeFindQuery(query);
    return await Producto.find(sanitizedQuery);
  }

  /**
   * Filter by category
   */
  async filterByCategory(category) {
    const sanitizedCategory = sanitizeValue(category);
    const categoryLookup = normalizeTaxonomyLookup(sanitizedCategory);
    const categoryPattern = taxonomyPatternFromValue(sanitizedCategory);
    const query = {
      $or: [
        { category: { $regex: sanitizedCategory, $options: 'i' } },
        { category: { $regex: categoryPattern || categoryLookup, $options: 'i' } },
        { category: { $regex: categoryLookup.replace(/\s+/g, '[ _-]*'), $options: 'i' } },
      ],
    };
    const sanitizedQuery = sanitizeFindQuery(query);
    return await Producto.find(sanitizedQuery);
  }

  /**
   * Filter by brand
   */
  async filterByBrand(brand) {
    const sanitizedBrand = sanitizeValue(brand);
    const brandLookup = normalizeTaxonomyLookup(sanitizedBrand);
    const brandPattern = taxonomyPatternFromValue(sanitizedBrand);
    const query = {
      $or: [
        { brand: { $regex: sanitizedBrand, $options: 'i' } },
        { brand: { $regex: brandPattern || brandLookup, $options: 'i' } },
        { brand: { $regex: brandLookup.replace(/\s+/g, '[ _-]*'), $options: 'i' } },
      ],
    };
    const sanitizedQuery = sanitizeFindQuery(query);
    return await Producto.find(sanitizedQuery);
  }

  /**
   * Bulk create/update products
   */
  async bulkUpsert(products) {
    const results = [];
    
    for (const producto of products) {
      const allowedFields = ['name', 'description', 'image', 'category', 'price', 'precioMayorista', 'stock', 'capacity', 'brand'];
      const filteredData = {};
      
      for (const field of allowedFields) {
        if (producto[field] !== undefined) {
          filteredData[field] = producto[field];
        }
      }

      const sanitizedData = sanitizeObject(filteredData);
      
      const filtro = {
        name: sanitizedData.name,
        category: sanitizedData.category,
        capacity: sanitizedData.capacity,
        brand: sanitizedData.brand
      };
      
      const sanitizedFiltro = sanitizeFindQuery(filtro);
      
      const actualizado = await Producto.findOneAndUpdate(
        sanitizedFiltro,
        sanitizedData,
        { upsert: true, new: true }
      );
      
      results.push(actualizado);
    }
    
    return results;
  }
}

// Helper functions at module level
const sanitizeValue = (value) => {
  if (typeof value !== 'string') return value;
  return value.replace(/[\$\{\}]/g, '');
};

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

module.exports = Object.assign(new ProductService(), {
  normalizeTaxonomyValue,
  validateTaxonomySelection,
  normalizeTaxonomyLookup,
});