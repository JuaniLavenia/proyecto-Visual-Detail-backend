/**
 * Product Service
 * Handles product CRUD operations
 */

const Producto = require('../models/Product');
const { sanitizeFindQuery, sanitizeUpdateQuery, sanitizeSort, sanitizeProjection } = require('../utils/query-sanitizer');
const { AppError } = require('../middleware/error.middleware');

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
    const allowedFields = ['name', 'description', 'image', 'category', 'price', 'stock', 'capacity', 'brand'];
    const sanitizedData = {};
    
    for (const field of allowedFields) {
      if (productData[field] !== undefined) {
        sanitizedData[field] = productData[field];
      }
    }

    const producto = new Producto(sanitizedData);
    return await producto.save();
  }

  /**
   * Update product
   */
  async update(id, updateData) {
    const allowedFields = ['name', 'description', 'image', 'category', 'price', 'stock', 'capacity', 'brand'];
    const sanitizedData = {};
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        sanitizedData[field] = updateData[field];
      }
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
    const query = { category: { $regex: sanitizedCategory, $options: 'i' } };
    const sanitizedQuery = sanitizeFindQuery(query);
    return await Producto.find(sanitizedQuery);
  }

  /**
   * Filter by brand
   */
  async filterByBrand(brand) {
    const sanitizedBrand = sanitizeValue(brand);
    const query = { brand: { $regex: sanitizedBrand, $options: 'i' } };
    const sanitizedQuery = sanitizeFindQuery(query);
    return await Producto.find(sanitizedQuery);
  }

  /**
   * Bulk create/update products
   */
  async bulkUpsert(products) {
    const results = [];
    
    for (const producto of products) {
      const allowedFields = ['name', 'description', 'image', 'category', 'price', 'stock', 'capacity', 'brand'];
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

module.exports = new ProductService();