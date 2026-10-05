const { query } = require('express-validator');

const MAX_SEARCH_LENGTH = 100;
const ROLE_VALUES = ['minorista', 'mayorista', 'admin'];
const STATUS_VALUES = ['active', 'inactive'];
const SORT_VALUES = ['newest', 'email'];

// GET /users - admin list query params
const listUsersQueryValidation = [
  query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('Page debe ser un número entre 1 y 100000'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit debe estar entre 1 y 100'),
  // A repeated param arrives as an array and is rejected
  query('search')
    .optional()
    .isString()
    .withMessage('Search debe ser un texto')
    .bail()
    .trim()
    .isLength({ max: MAX_SEARCH_LENGTH })
    .withMessage(`Search no puede superar ${MAX_SEARCH_LENGTH} caracteres`),
  query('role')
    .optional()
    .isIn(ROLE_VALUES)
    .withMessage(`Role debe ser uno de: ${ROLE_VALUES.join(', ')}`),
  query('status')
    .optional()
    .isIn(STATUS_VALUES)
    .withMessage(`Status debe ser uno de: ${STATUS_VALUES.join(', ')}`),
  query('sort')
    .optional()
    .isIn(SORT_VALUES)
    .withMessage(`Sort debe ser uno de: ${SORT_VALUES.join(', ')}`),
];

module.exports = {
  MAX_SEARCH_LENGTH,
  ROLE_VALUES,
  STATUS_VALUES,
  SORT_VALUES,
  listUsersQueryValidation,
};
