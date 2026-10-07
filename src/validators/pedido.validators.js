const { body } = require('express-validator');

const PHONE_MIN_DIGITS = 8;
const PHONE_MAX_DIGITS = 15;
const MAX_PRODUCT_NAME_LENGTH = 200;
const MAX_PRODUCT_QUANTITY = 10000;

// Digits, spaces, "+", "-" and parentheses are accepted as typed
const PHONE_ALLOWED_CHARS = /^[\d\s+()-]+$/;
const NORMALIZED_PHONE = new RegExp(`^\\+?\\d{${PHONE_MIN_DIGITS},${PHONE_MAX_DIGITS}}$`);

/**
 * Normalize a phone to an optional leading "+" followed by digits only.
 * Returns null when the input is not a valid phone (8-15 digits, "+" only
 * as the first non-space character).
 */
const normalizePhone = (value) => {
  if (typeof value !== 'string' || !PHONE_ALLOWED_CHARS.test(value)) return null;
  const compact = value.replace(/[\s()-]/g, '');
  return NORMALIZED_PHONE.test(compact) ? compact : null;
};

// POST /pedidos - the owner comes from the token, never from the body
const createPedidoValidation = [
  body('productos')
    .isArray({ min: 1 })
    .withMessage('Productos debe ser un array no vacío'),
  body('productos.*.nombre')
    .isString()
    .withMessage('Cada producto debe tener un nombre')
    .bail()
    .trim()
    .isLength({ min: 1, max: MAX_PRODUCT_NAME_LENGTH })
    .withMessage(`El nombre del producto debe tener entre 1 y ${MAX_PRODUCT_NAME_LENGTH} caracteres`),
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
      `Teléfono inválido: usá solo números, espacios, +, - o paréntesis (entre ${PHONE_MIN_DIGITS} y ${PHONE_MAX_DIGITS} dígitos)`
    )
    .bail()
    .customSanitizer(normalizePhone),
];

module.exports = {
  PHONE_MIN_DIGITS,
  PHONE_MAX_DIGITS,
  normalizePhone,
  createPedidoValidation,
};
