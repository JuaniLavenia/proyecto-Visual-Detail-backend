const test = require('node:test');
const assert = require('node:assert/strict');

const Pedido = require('./Order');
const Producto = require('./Product');
const CartItem = require('./Cart');
const Favorite = require('./Favorite');

// Index options declared on a single-field index, or undefined when missing
const indexOn = (Model, field) => {
  const found = Model.schema.indexes().find(([fields]) => Object.keys(fields).length === 1 && fields[field] === 1);
  return found ? found[1] : undefined;
};

for (const [Model, field] of [
  [Pedido, 'usuario'],
  [Pedido, 'estado'],
  [Producto, 'brand'],
  [Producto, 'category'],
]) {
  test(`${Model.modelName}.${field} has a regular index`, () => {
    const options = indexOn(Model, field);
    assert.ok(options, `missing index on ${field}`);
    assert.notEqual(options.unique, true);
  });
}

for (const Model of [CartItem, Favorite]) {
  test(`${Model.modelName}.userId has a unique index`, () => {
    const options = indexOn(Model, 'userId');
    assert.ok(options, 'missing index on userId');
    assert.equal(options.unique, true);
  });
}

test('Pedido.numeroPedido keeps its unique index', () => {
  assert.equal(indexOn(Pedido, 'numeroPedido')?.unique, true);
});
