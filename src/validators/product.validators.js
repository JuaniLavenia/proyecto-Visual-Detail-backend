const { query } = require('express-validator');

const MAX_FILTER_LENGTH = 100;
const SORT_VALUES = ['price_asc', 'price_desc'];

// Optional free-text filter: must be a single string (a repeated param
// arrives as an array and is rejected), trimmed and length-capped.
const filterParam = (field, label) =>
  query(field)
    .optional()
    .isString()
    .withMessage(`${label} debe ser un texto`)
    .bail()
    .trim()
    .isLength({ max: MAX_FILTER_LENGTH })
    .withMessage(`${label} no puede superar ${MAX_FILTER_LENGTH} caracteres`);

// GET /productos - list query params
const listProductsQueryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page debe ser un número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit debe estar entre 1 y 100'),
  filterParam('brand', 'Brand'),
  filterParam('category', 'Category'),
  filterParam('search', 'Search'),
  query('sort')
    .optional()
    .isIn(SORT_VALUES)
    .withMessage(`Sort debe ser uno de: ${SORT_VALUES.join(', ')}`),
];

module.exports = {
  MAX_FILTER_LENGTH,
  SORT_VALUES,
  listProductsQueryValidation,
};
