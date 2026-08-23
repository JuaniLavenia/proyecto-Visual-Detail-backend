const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');
const { requestValidation } = require('../middleware/common.middleware');
const {
  getBrands,
  getCategories,
  createBrand,
  createCategory,
  updateBrand,
  updateCategory,
  deleteBrand,
  deleteCategory,
} = require('../controllers/taxonomy.controller');

router.get('/brands', getBrands);
router.get('/categories', getCategories);

router.post(
  '/brands',
  authenticate,
  isAdmin,
  [
    body('name').trim().notEmpty().withMessage('El nombre es requerido'),
    body('isActive').optional().isBoolean().withMessage('isActive debe ser booleano'),
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
    body('isActive').optional().isBoolean().withMessage('isActive debe ser booleano'),
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
    body('isActive').optional().isBoolean().withMessage('isActive debe ser booleano'),
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
    body('isActive').optional().isBoolean().withMessage('isActive debe ser booleano'),
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
