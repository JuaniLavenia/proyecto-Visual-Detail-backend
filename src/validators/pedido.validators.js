const { body, query } = require('express-validator');

const ESTADO_VALUES = ['Pendiente', 'Completado', 'Cancelado'];
const MAX_SEARCH_LENGTH = 100;
const PHONE_MIN_DIGITS = 8;
const PHONE_MAX_DIGITS = 15;
const MAX_ORDER_LINES = 50;
const MAX_PRODUCT_QUANTITY = 10000;

// Digits, spaces, "+", "-" and parentheses are accepted as typed
const PHONE_ALLOWED_CHARS = /^[\d\s+()-]+$/;
const INTERNATIONAL_PHONE = new RegExp(`^\\+\\d{${PHONE_MIN_DIGITS},${PHONE_MAX_DIGITS}}$`);
const DIGITS_ONLY = /^\d+$/;
// Area codes in Argentina have 2 to 4 digits; the mobile "15" follows them
const AREA_CODE_LENGTHS = [2, 3, 4];

/**
 * Normalize a national Argentine number (digits only, no "+") to the
 * "+549" mobile international format, or null when it is not one.
 */
const normalizeArgentinePhone = (digits) => {
  if (digits.startsWith('549') && digits.length === 13) return `+${digits}`;
  if (digits.startsWith('54') && digits.length === 12) return `+549${digits.slice(2)}`;

  // Trunk prefix "0"
  let national = digits.startsWith('0') ? digits.slice(1) : digits;
  if (national.length === 12) {
    const areaLength = AREA_CODE_LENGTHS.find((len) => national.slice(len, len + 2) === '15');
    if (areaLength !== undefined) {
      national = national.slice(0, areaLength) + national.slice(areaLength + 2);
    }
  }
  return national.length === 10 ? `+549${national}` : null;
};

/**
 * Normalize a phone. Numbers typed with a leading "+" are international and
 * kept as "+" plus digits (8-15 digits). Any other number is taken as
 * Argentine and converted to "+549" + area code + number. Returns null when
 * the input is not a valid phone.
 */
const normalizePhone = (value) => {
  if (typeof value !== 'string' || !PHONE_ALLOWED_CHARS.test(value)) return null;
  const compact = value.replace(/[\s()-]/g, '');
  if (compact.startsWith('+')) {
    return INTERNATIONAL_PHONE.test(compact) ? compact : null;
  }
  return DIGITS_ONLY.test(compact) ? normalizeArgentinePhone(compact) : null;
};

// POST /pedidos - the owner comes from the token, never from the body
const createPedidoValidation = [
  body('productos')
    .isArray({ min: 1, max: MAX_ORDER_LINES })
    .withMessage(`Productos debe ser un array de 1 a ${MAX_ORDER_LINES} elementos`),
  // Name and price come from the database, never from the client
  body('productos.*.productId')
    .isMongoId()
    .withMessage('Cada producto debe tener un productId válido'),
  body('productos.*.cantidad')
    .isInt({ min: 1, max: MAX_PRODUCT_QUANTITY })
    .withMessage(`La cantidad debe ser un entero entre 1 y ${MAX_PRODUCT_QUANTITY}`)
    .bail()
    .toInt(),
  // Omitted, null or empty: the stored profile phone is used instead
  body('telefono')
    .optional({ values: 'falsy' })
    .custom((value) => normalizePhone(value) !== null)
    .withMessage(
      'Teléfono inválido: ingresá tu celular con código de área (ej: 381 4159688) o en formato internacional con +'
    )
    .bail()
    .customSanitizer(normalizePhone),
];

// GET /admin/pedidos - admin list query params
const listAdminPedidosQueryValidation = [
  query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('Page debe ser un número entre 1 y 100000'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit debe ser 1-100'),
  query('estado')
    .optional()
    .isIn(['todos', ...ESTADO_VALUES])
    .withMessage('Estado inválido'),
  // A repeated param arrives as an array and is rejected
  query('search')
    .optional()
    .isString()
    .withMessage('Search debe ser un texto')
    .bail()
    .trim()
    .isLength({ max: MAX_SEARCH_LENGTH })
    .withMessage(`Search no puede superar ${MAX_SEARCH_LENGTH} caracteres`),
];

module.exports = {
  PHONE_MIN_DIGITS,
  PHONE_MAX_DIGITS,
  MAX_SEARCH_LENGTH,
  MAX_ORDER_LINES,
  MAX_PRODUCT_QUANTITY,
  ESTADO_VALUES,
  normalizePhone,
  createPedidoValidation,
  listAdminPedidosQueryValidation,
};
