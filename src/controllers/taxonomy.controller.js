const { asyncHandler } = require("../middleware/error.middleware");
const { success } = require("../utils/response-formatter");
const taxonomyService = require("../services/taxonomy.service");
const Brand = require("../models/Brand");
const Category = require("../models/Category");

const getBrands = asyncHandler(async (req, res) => {
  const items = await taxonomyService.list(Brand, { isActive: true });
  res.json(success(items));
});

const getCategories = asyncHandler(async (req, res) => {
  const items = await taxonomyService.list(Category, { isActive: true });
  res.json(success(items));
});

const createBrand = asyncHandler(async (req, res) => {
  const item = await taxonomyService.create(Brand, req.body);
  res.status(201).json(success(item, "Marca creada"));
});

const createCategory = asyncHandler(async (req, res) => {
  const item = await taxonomyService.create(Category, req.body);
  res.status(201).json(success(item, "Categoría creada"));
});

const updateBrand = asyncHandler(async (req, res) => {
  const item = await taxonomyService.update(Brand, req.params.id, req.body);
  res.json(success(item, "Marca actualizada"));
});

const updateCategory = asyncHandler(async (req, res) => {
  const item = await taxonomyService.update(Category, req.params.id, req.body);
  res.json(success(item, "Categoría actualizada"));
});

const deleteBrand = asyncHandler(async (req, res) => {
  await taxonomyService.remove(Brand, req.params.id);
  res.json(success(null, "Marca eliminada"));
});

const deleteCategory = asyncHandler(async (req, res) => {
  await taxonomyService.remove(Category, req.params.id);
  res.json(success(null, "Categoría eliminada"));
});

module.exports = {
  getBrands,
  getCategories,
  createBrand,
  createCategory,
  updateBrand,
  updateCategory,
  deleteBrand,
  deleteCategory,
};
