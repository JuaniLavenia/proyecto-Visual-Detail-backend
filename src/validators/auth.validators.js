const { body } = require('express-validator');

const PASSWORD_MIN_LENGTH = 8;
// bcrypt only uses the first 72 bytes of a password
const PASSWORD_MAX_LENGTH = 72;
const PASSWORD_LENGTH_MESSAGE = `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres`;
const PASSWORD_MISMATCH_MESSAGE = 'Las contraseñas no coinciden';

// Shared rule for every route that sets a new password
const passwordRule = (field = 'password') =>
  body(field)
    .isString()
    .withMessage(PASSWORD_LENGTH_MESSAGE)
    .bail()
    .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
    .withMessage(PASSWORD_LENGTH_MESSAGE);

// New password plus a matching confirmation field
const passwordWithConfirmationRule = (field = 'password', confirmationField = 'password_confirmation') =>
  passwordRule(field)
    .bail()
    .custom((value, { req }) => value === req.body[confirmationField])
    .withMessage(PASSWORD_MISMATCH_MESSAGE);

// Auth e-mail: a non-string (array/object) is a 400, never a 500
const authEmailRule = () =>
  body('email')
    .isString()
    .withMessage('El correo es requerido')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('El correo es requerido')
    .isEmail()
    .withMessage('El correo es incorrecto');

// Login only checks presence: existing users may have shorter passwords
const loginPasswordRule = () =>
  body('password')
    .isString()
    .withMessage('La contraseña es requerida')
    .bail()
    .notEmpty()
    .withMessage('La contraseña es requerida');

module.exports = {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_LENGTH_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
  passwordRule,
  passwordWithConfirmationRule,
  authEmailRule,
  loginPasswordRule,
};
