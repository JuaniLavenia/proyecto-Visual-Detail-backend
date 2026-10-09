const { asyncHandler } = require('../middleware/error.middleware');
const { success } = require('../utils/response-formatter');
const taxonomyService = require('../services/taxonomy.service');
const Brand = require('../models/Brand');
const Category = require('../models/Category');

// `?home=true` narrows the public list to what the admin marked for the home
const listPublic = (Model) =>
  asyncHandler(async (req, res) => {
    const items =
      req.query.home === 'true'
        ? await taxonomyService.listForHome(Model)
        : await taxonomyService.list(Model, { isActive: true });
    res.json(success(items));
  });

const getBrands = listPublic(Brand);
const getCategories = listPublic(Category);

// Listados administrativos: incluyen entradas inactivas (p. ej. las que crea
// bulkUpsert automaticamente para valores de Excel que no existian) para que
// el admin las pueda revisar, activar o eliminar desde el panel.
const getAllBrands = asyncHandler(async (req, res) => {
  const items = await taxonomyService.list(Brand);
  res.json(success(items));
});

const getAllCategories = asyncHandler(async (req, res) => {
  const items = await taxonomyService.list(Category);
  res.json(success(items));
});

const createBrand = asyncHandler(async (req, res) => {
  const item = await taxonomyService.create(Brand, req.body);
  res.status(201).json(success(item, 'Marca creada'));
});

const createCategory = asyncHandler(async (req, res) => {
  const item = await taxonomyService.create(Category, req.body);
  res.status(201).json(success(item, 'Categoría creada'));
});

// data stays the updated entry; a rename that moved products says how many
const updatedMessage = (label, productsUpdated) =>
  productsUpdated > 0 ? `${label}. Productos actualizados: ${productsUpdated}` : label;

const updateBrand = asyncHandler(async (req, res) => {
  const { item, productsUpdated } = await taxonomyService.update(Brand, req.params.id, req.body);
  res.json(success(item, updatedMessage('Marca actualizada', productsUpdated)));
});

const updateCategory = asyncHandler(async (req, res) => {
  const { item, productsUpdated } = await taxonomyService.update(Category, req.params.id, req.body);
  res.json(success(item, updatedMessage('Categoría actualizada', productsUpdated)));
});

const deleteBrand = asyncHandler(async (req, res) => {
  await taxonomyService.remove(Brand, req.params.id);
  res.json(success(null, 'Marca eliminada'));
});

const deleteCategory = asyncHandler(async (req, res) => {
  await taxonomyService.remove(Category, req.params.id);
  res.json(success(null, 'Categoría eliminada'));
});

module.exports = {
  getBrands,
  getCategories,
  getAllBrands,
  getAllCategories,
  createBrand,
  createCategory,
  updateBrand,
  updateCategory,
  deleteBrand,
  deleteCategory,
};
