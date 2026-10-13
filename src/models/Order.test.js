const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const Pedido = require('./Order');
const Counter = require('./Counter');

const USER_ID = '64b7f0c2a1b2c3d4e5f60702';

const restorers = [];
const stub = (obj, key, impl) => {
  const hadOwn = Object.prototype.hasOwnProperty.call(obj, key);
  const original = obj[key];
  obj[key] = impl;
  restorers.push(() => {
    if (hadOwn) obj[key] = original;
    else delete obj[key];
  });
};

afterEach(() => {
  while (restorers.length) restorers.pop()();
});

// Runs the real save() middleware but never writes to MongoDB
const stubDriverWrite = () => {
  const written = [];
  stub(Pedido.prototype, '$__handleSave', function handleSave(options, callback) {
    written.push(this.numeroPedido);
    callback(null, null);
  });
  return written;
};

test('saving a new order takes numeroPedido from the counter, not from the highest order', async () => {
  const written = stubDriverWrite();
  const incs = [];
  stub(Counter, 'findOneAndUpdate', async (filter, update, options) => {
    incs.push([filter, update, options]);
    return { _id: filter._id, seq: 7 };
  });
  stub(Pedido, 'findOne', async () => {
    throw new Error('the hook must not scan for the highest order');
  });

  const pedido = await new Pedido({ usuario: USER_ID }).save();

  assert.equal(pedido.numeroPedido, 7);
  assert.deepEqual(written, [7]);
  assert.equal(incs.length, 1);
  assert.deepEqual(incs[0][1], { $inc: { seq: 1 } });
});

test('saving an order that already has a numeroPedido keeps it and leaves the counter alone', async () => {
  const written = stubDriverWrite();
  stub(Counter, 'findOneAndUpdate', async () => {
    throw new Error('counter must not move');
  });

  const pedido = await new Pedido({ usuario: USER_ID, numeroPedido: 15 }).save();

  assert.equal(pedido.numeroPedido, 15);
  assert.deepEqual(written, [15]);
});

test('a counter failure rejects the save and nothing is written', async () => {
  const written = stubDriverWrite();
  stub(Counter, 'findOneAndUpdate', async () => {
    throw new Error('counter unavailable');
  });

  await assert.rejects(new Pedido({ usuario: USER_ID }).save(), /counter unavailable/);
  assert.deepEqual(written, []);
});
