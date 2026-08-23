const test = require('node:test');
const assert = require('node:assert/strict');

const Brand = require('./Brand');
const Category = require('./Category');

test('Brand slug is generated from the name and persistable', () => {
  const brand = new Brand({ name: 'Toxic Shine', isActive: true });
  assert.equal(brand.slug, 'toxic-shine');
  assert.equal(brand.isActive, true);
});

test('Category slug is generated from the name and persistable', () => {
  const category = new Category({ name: 'Línea Profesional', isActive: true });
  assert.equal(category.slug, 'linea-profesional');
  assert.equal(category.isActive, true);
});
