const { AppError } = require("../middleware/error.middleware");
const FilterConfig = require("../models/FilterConfig");

const ALLOWED_FILTER_KEYS = ["category", "brand"];
const DEFAULT_FILTERS = [
  { key: "category", label: "Categorías", isActive: true, sortOrder: 0 },
  { key: "brand", label: "Marcas", isActive: true, sortOrder: 1 },
];

const sortFilters = (filters) =>
  [...filters].sort((left, right) => left.sortOrder - right.sortOrder);

const normalizeFilters = (filters) => {
  if (!Array.isArray(filters)) {
    throw new AppError("filters debe ser un array", 400, "FILTERS_REQUIRED");
  }

  const seenKeys = new Set();
  return filters.map((filter, index) => {
    const key = typeof filter?.key === "string" ? filter.key.trim() : "";
    const label = typeof filter?.label === "string" ? filter.label.trim() : "";

    if (!ALLOWED_FILTER_KEYS.includes(key)) {
      throw new AppError(
        `Clave de filtro no permitida: ${key || "vacía"}`,
        400,
        "FILTER_KEY_NOT_ALLOWED",
      );
    }
    if (seenKeys.has(key)) {
      throw new AppError(`Filtro duplicado: ${key}`, 400, "DUPLICATE_FILTER");
    }
    seenKeys.add(key);
    if (!label) {
      throw new AppError(
        "La etiqueta del filtro es requerida",
        400,
        "FILTER_LABEL_REQUIRED",
      );
    }
    if (typeof filter?.isActive !== "boolean") {
      throw new AppError(
        "isActive debe ser booleano",
        400,
        "FILTER_ACTIVE_INVALID",
      );
    }

    return { key, label, isActive: filter.isActive, sortOrder: index };
  });
};

const toConfigData = (config, filters) => ({
  key: config.key,
  filters: sortFilters(filters || config.filters || []).map((filter) => ({
    key: filter.key,
    label: filter.label,
    isActive: filter.isActive,
    sortOrder: filter.sortOrder,
  })),
});

class FilterConfigService {
  async getOrCreate() {
    let config = await FilterConfig.findOne({ key: "plp" });
    if (!config) {
      config = await FilterConfig.create({
        key: "plp",
        filters: DEFAULT_FILTERS,
      });
    }
    return config;
  }

  async getPublicConfig() {
    const config = await this.getOrCreate();
    return toConfigData(
      config,
      config.filters.filter((filter) => filter.isActive),
    );
  }

  async getAdminConfig() {
    return toConfigData(await this.getOrCreate());
  }

  async updateConfig(payload) {
    const filters = normalizeFilters(payload?.filters);
    const config = await FilterConfig.findOneAndUpdate(
      { key: "plp" },
      { $set: { filters } },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    return toConfigData(config);
  }
}

module.exports = new FilterConfigService();
module.exports.normalizeFilters = normalizeFilters;
module.exports.DEFAULT_FILTERS = DEFAULT_FILTERS;
