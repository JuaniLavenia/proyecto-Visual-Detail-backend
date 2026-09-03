const { AppError } = require('../middleware/error.middleware');
const Producto = require('../models/Product');

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;
const escapeRegex = (value) => String(value ?? '').replace(REGEX_SPECIAL_CHARS, '\\$&');

const buildTaxonomyQuery = (Model, filters = {}) => {
  const query = {};

  if (filters.name) {
    query.name = { $regex: filters.name, $options: 'i' };
  }

  if (filters.isActive !== undefined) {
    query.isActive = Boolean(filters.isActive);
  }

  return query;
};

const normalizeCreatePayload = (payload) => {
  const name = typeof payload?.name === 'string' ? payload.name.trim() : '';

  if (!name) {
    throw new AppError('El nombre es requerido', 400, 'TAXONOMY_NAME_REQUIRED');
  }

  return {
    name,
    description: typeof payload?.description === 'string' ? payload.description.trim() : '',
    isActive: payload?.isActive !== undefined ? Boolean(payload.isActive) : true,
    sortOrder: Number.isFinite(Number(payload?.sortOrder)) ? Number(payload.sortOrder) : 0,
    metadata: payload?.metadata || {},
  };
};

// A PUT is a partial update: only fields actually present in the payload
// are normalized and applied, so omitted fields keep their stored value
// instead of being silently reset to the create-time defaults.
const normalizeUpdatePayload = (payload) => {
  const updates = {};

  if (payload?.name !== undefined) {
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name) {
      throw new AppError('El nombre es requerido', 400, 'TAXONOMY_NAME_REQUIRED');
    }
    updates.name = name;
  }

  if (payload?.description !== undefined) {
    updates.description = typeof payload.description === 'string' ? payload.description.trim() : '';
  }

  if (payload?.isActive !== undefined) {
    updates.isActive = Boolean(payload.isActive);
  }

  if (payload?.sortOrder !== undefined) {
    updates.sortOrder = Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0;
  }

  if (payload?.metadata !== undefined) {
    updates.metadata = payload.metadata || {};
  }

  return updates;
};

class TaxonomyService {
  async list(Model, filters = {}) {
    const query = buildTaxonomyQuery(Model, filters);
    return Model.find(query).sort({ sortOrder: 1, name: 1 }).lean();
  }

  async create(Model, payload) {
    const sanitized = normalizeCreatePayload(payload);
    const item = new Model(sanitized);
    return item.save();
  }

  async update(Model, id, payload) {
    const updates = normalizeUpdatePayload(payload);
    const item = await Model.findById(id);

    if (!item) {
      throw new AppError('Registro no encontrado', 404, 'TAXONOMY_NOT_FOUND');
    }

    Object.assign(item, updates);
    // .save() (not findByIdAndUpdate) so the pre('validate') slug-sync hook
    // actually runs when name changes - findByIdAndUpdate only runs
    // SchemaType validators, not document middleware.
    await item.save();

    return item;
  }

  async remove(Model, id) {
    const item = await Model.findById(id);
    if (!item) {
      throw new AppError('Registro no encontrado', 404, 'TAXONOMY_NOT_FOUND');
    }

    const field = Model.modelName === 'Brand' ? 'brand' : 'category';
    const inUse = await Producto.countDocuments({
      [field]: { $regex: `^${escapeRegex(item.name)}$`, $options: 'i' },
    });

    if (inUse > 0) {
      const label = Model.modelName === 'Brand' ? 'la marca' : 'la categoría';
      throw new AppError(
        `No se puede eliminar ${label} porque tiene productos asociados. Desactivala o reasigná esos productos primero.`,
        409,
        'TAXONOMY_IN_USE',
      );
    }

    await Model.findByIdAndDelete(id);
    return true;
  }
}

module.exports = new TaxonomyService();
