const { AppError } = require("../middleware/error.middleware");

const buildTaxonomyQuery = (Model, filters = {}) => {
  const query = {};

  if (filters.name) {
    query.name = { $regex: filters.name, $options: "i" };
  }

  if (filters.isActive !== undefined) {
    query.isActive = Boolean(filters.isActive);
  }

  return query;
};

const normalizePayload = (payload) => {
  const name = typeof payload?.name === "string" ? payload.name.trim() : "";

  if (!name) {
    throw new AppError("El nombre es requerido", 400, "TAXONOMY_NAME_REQUIRED");
  }

  return {
    name,
    description:
      typeof payload?.description === "string"
        ? payload.description.trim()
        : "",
    isActive:
      payload?.isActive !== undefined ? Boolean(payload.isActive) : true,
    sortOrder: Number.isFinite(Number(payload?.sortOrder))
      ? Number(payload.sortOrder)
      : 0,
    metadata: payload?.metadata || {},
  };
};

class TaxonomyService {
  async list(Model, filters = {}) {
    const query = buildTaxonomyQuery(Model, filters);
    return Model.find(query).sort({ sortOrder: 1, name: 1 }).lean();
  }

  async create(Model, payload) {
    const sanitized = normalizePayload(payload);
    const item = new Model(sanitized);
    return item.save();
  }

  async update(Model, id, payload) {
    const sanitized = normalizePayload(payload);
    const item = await Model.findByIdAndUpdate(id, sanitized, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      throw new AppError("Registro no encontrado", 404, "TAXONOMY_NOT_FOUND");
    }

    return item;
  }

  async remove(Model, id) {
    const deleted = await Model.findByIdAndDelete(id);
    if (!deleted) {
      throw new AppError("Registro no encontrado", 404, "TAXONOMY_NOT_FOUND");
    }
    return true;
  }
}

module.exports = new TaxonomyService();
