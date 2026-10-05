const { query, body, param } = require('express-validator');

const MAX_SEARCH_LENGTH = 100;
const MAX_NAME_LENGTH = 80;
const ADMIN_EDITABLE_FIELDS = ['name', 'email', 'role', 'isActive'];
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

const userIdParamValidation = [
  param('id').isMongoId().withMessage('ID de usuario inválido'),
];

// Email is normalized to trimmed lowercase (no provider-specific rewriting)
const emailField = () =>
  body('email')
    .isString()
    .withMessage('Email inválido')
    .bail()
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Email inválido');

const nameField = () =>
  body('name')
    .optional()
    .isString()
    .withMessage('El nombre debe ser un texto')
    .bail()
    .trim()
    .isLength({ max: MAX_NAME_LENGTH })
    .withMessage(`El nombre no puede superar ${MAX_NAME_LENGTH} caracteres`);

const roleField = () =>
  body('role')
    .optional()
    .isIn(ROLE_VALUES)
    .withMessage(`Role inválido. Debe ser: ${ROLE_VALUES.join(', ')}`);

// POST /users - admin creates a user (no password: an invite mail is sent)
// A missing email fails isString, so it is required here
const createUserValidation = [
  emailField(),
  nameField(),
  roleField(),
];

// PATCH /users/:id - admin edits a user
const updateUserValidation = [
  ...userIdParamValidation,
  body()
    .custom((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const keys = Object.keys(value);
      return keys.length > 0 && keys.every((key) => ADMIN_EDITABLE_FIELDS.includes(key));
    })
    .withMessage(`Solo se pueden modificar: ${ADMIN_EDITABLE_FIELDS.join(', ')}`),
  emailField().optional(),
  nameField(),
  roleField(),
  // Real JSON boolean only: the string "false" would be truthy downstream
  body('isActive')
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage('isActive debe ser true o false'),
];

module.exports = {
  MAX_SEARCH_LENGTH,
  MAX_NAME_LENGTH,
  ROLE_VALUES,
  STATUS_VALUES,
  SORT_VALUES,
  ADMIN_EDITABLE_FIELDS,
  listUsersQueryValidation,
  userIdParamValidation,
  createUserValidation,
  updateUserValidation,
};
