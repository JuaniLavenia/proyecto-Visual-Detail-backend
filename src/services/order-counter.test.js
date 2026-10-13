const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const Counter = require('../models/Counter');
const Pedido = require('../models/Order');
const { ensureOrderCounter, nextOrderNumber, ORDER_COUNTER_ID } = require('./order-counter');

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

/**
 * In-memory counter collection that applies $inc and $max like MongoDB,
 * including upserts, and records every call in order.
 */
const fakeCounterStore = ({ seq, highestOrder = null } = {}) => {
  const log = [];
  const state = { seq };

  stub(Pedido, 'findOne', async (filter, projection, options) => {
    log.push(['Pedido.findOne', filter, projection, options]);
    return highestOrder == null ? null : { numeroPedido: highestOrder };
  });
  stub(Counter, 'updateOne', async (filter, update, options) => {
    log.push(['updateOne', filter, update, options]);
    if (state.seq === undefined && !options?.upsert) return { matchedCount: 0 };
    state.seq = Math.max(state.seq ?? update.$max.seq, update.$max.seq);
    return { matchedCount: 1 };
  });
  stub(Counter, 'findOneAndUpdate', async (filter, update, options) => {
    log.push(['findOneAndUpdate', filter, update, options]);
    if (state.seq === undefined && !options?.upsert) return null;
    state.seq = (state.seq ?? 0) + update.$inc.seq;
    return { _id: filter._id, seq: state.seq };
  });

  return { log, state };
};

test('nextOrderNumber takes the next value from the counter with $inc', async () => {
  const { log, state } = fakeCounterStore({ seq: 41 });

  const number = await nextOrderNumber();

  assert.equal(number, 42);
  assert.equal(state.seq, 42);
  assert.equal(log.length, 1);
  const [op, filter, update, options] = log[0];
  assert.equal(op, 'findOneAndUpdate');
  assert.deepEqual(filter, { _id: ORDER_COUNTER_ID });
  assert.deepEqual(update, { $inc: { seq: 1 } });
  assert.equal(options.new, true);
});

test('ensureOrderCounter seeds the counter with $max from the highest numeroPedido', async () => {
  const { log, state } = fakeCounterStore({ highestOrder: 120 });

  const seeded = await ensureOrderCounter();

  assert.equal(seeded, 120);
  assert.equal(state.seq, 120);
  const [, , , findOptions] = log[0];
  assert.deepEqual(findOptions.sort, { numeroPedido: -1 });
  assert.deepEqual(log[1], [
    'updateOne',
    { _id: ORDER_COUNTER_ID },
    { $max: { seq: 120 } },
    { upsert: true },
  ]);
});

test('ensureOrderCounter never lowers a counter that is already ahead (idempotent)', async () => {
  const { state } = fakeCounterStore({ seq: 150, highestOrder: 120 });

  await ensureOrderCounter();
  await ensureOrderCounter();

  assert.equal(state.seq, 150);
});

test('ensureOrderCounter seeds 0 when there are no orders, so the first order is number 1', async () => {
  const { state } = fakeCounterStore();

  await ensureOrderCounter();
  const number = await nextOrderNumber();

  assert.equal(number, 1);
  assert.equal(state.seq, 1);
});

test('with the counter missing and orders present, numbering continues after the highest order', async () => {
  const { log } = fakeCounterStore({ highestOrder: 41 });

  const number = await nextOrderNumber();

  assert.equal(number, 42);
  assert.deepEqual(
    log.map(([op]) => op),
    ['findOneAndUpdate', 'Pedido.findOne', 'updateOne', 'findOneAndUpdate'],
  );
  // The increment that may create the counter only runs after the seed
  assert.equal(log[0][3].upsert, undefined);
  assert.equal(log[3][3].upsert, true);
});
