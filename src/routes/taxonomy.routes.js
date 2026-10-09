const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');
const { requestValidation } = require('../middleware/common.middleware');
const {
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
} = require('../controllers/taxonomy.controller');
const { IMAGE_URL_MAX_LENGTH } = require('../utils/image-url');

// Optional fields shared by create and update. Booleans are converted with
// toBoolean so the string "false" reaches the service as false.
const taxonomyFieldRules = [
  body('isActive').optional().isBoolean().withMessage('isActive debe ser booleano').toBoolean(),
  body('showOnHome').optional().isBoolean().withMessage('showOnHome debe ser booleano').toBoolean(),
  body('image')
    .optional()
    .isString()
    .withMessage('La imagen debe ser una URL')
    .bail()
    .trim()
    .isLength({ max: IMAGE_URL_MAX_LENGTH })
    .withMessage(`La URL de la imagen no puede superar ${IMAGE_URL_MAX_LENGTH} caracteres`)
    .bail()
    // Empty clears the image; anything else must be an absolute http(s) URL
    .if((value) => value !== '')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('La imagen debe ser una URL http(s) válida'),
];

router.get('/brands', getBrands);
router.get('/categories', getCategories);

router.get('/brands/all', authenticate, isAdmin, getAllBrands);
router.get('/categories/all', authenticate, isAdmin, getAllCategories);

router.post(
  '/brands',
  authenticate,
  isAdmin,
  [
    body('name').trim().notEmpty().withMessage('El nombre es requerido'),
    ...taxonomyFieldRules,
  ],
  requestValidation,
  createBrand,
);

router.post(
  '/categories',
  authenticate,
  isAdmin,
  [
    body('name').trim().notEmpty().withMessage('El nombre es requerido'),
    ...taxonomyFieldRules,
  ],
  requestValidation,
  createCategory,
);

router.put(
  '/brands/:id',
  authenticate,
  isAdmin,
  [
    param('id').isMongoId().withMessage('ID inválido'),
    body('name').optional().trim().notEmpty().withMessage('El nombre es requerido'),
    ...taxonomyFieldRules,
  ],
  requestValidation,
  updateBrand,
);

router.put(
  '/categories/:id',
  authenticate,
  isAdmin,
  [
    param('id').isMongoId().withMessage('ID inválido'),
    body('name').optional().trim().notEmpty().withMessage('El nombre es requerido'),
    ...taxonomyFieldRules,
  ],
  requestValidation,
  updateCategory,
);

router.delete(
  '/brands/:id',
  authenticate,
  isAdmin,
  [param('id').isMongoId().withMessage('ID inválido')],
  requestValidation,
  deleteBrand,
);

router.delete(
  '/categories/:id',
  authenticate,
  isAdmin,
  [param('id').isMongoId().withMessage('ID inválido')],
  requestValidation,
  deleteCategory,
);

module.exports = router;
