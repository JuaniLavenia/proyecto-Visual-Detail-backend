const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const pedidoService = require('../services/pedido.service');
const { createPedido } = require('./pedidos.controller');

const original = { createForUser: pedidoService.createForUser };

let calls;

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

// asyncHandler does not return the inner promise: wait for res.json or next
const invoke = (handler, req) =>
  new Promise((resolve) => {
    const res = mockRes();
    const json = res.json;
    res.json = (body) => {
      json(body);
      resolve({ res });
      return res;
    };
    handler(req, res, (err) => resolve({ res, err }));
  });

beforeEach(() => {
  calls = [];
  pedidoService.createForUser = async (user, data) => {
    calls.push({ user, data });
    return { numeroPedido: 7, telefono: data.telefono ?? user.phone };
  };
});

afterEach(() => {
  pedidoService.createForUser = original.createForUser;
});

test('createPedido uses the token user and ignores usuario from the body', async () => {
  const user = { _id: 'token-user', phone: '1145678901' };
  const req = {
    user,
    userId: user._id,
    body: { usuario: 'someone-else', productos: [{ nombre: 'Cera', cantidad: 1 }], telefono: '+541123456789' },
  };

  const { res, err } = await invoke(createPedido, req);

  assert.equal(err, undefined);
  assert.equal(res.statusCode, 201);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].user, user);
  assert.deepEqual(calls[0].data, {
    productos: [{ nombre: 'Cera', cantidad: 1 }],
    telefono: '+541123456789',
  });
  assert.equal(res.body.success, true);
});

// ---------- modificarEstadoPedido ----------

const { modificarEstadoPedido } = require('./pedidos.controller');

const OWNER_ID = '64b7f0c2a1b2c3d4e5f60711';
const ORDER_ID = '64b7f0c2a1b2c3d4e5f60799';

const stubOrder = (estado) => {
  const updates = [];
  pedidoService.findById = async (id) => (id === ORDER_ID ? { _id: ORDER_ID, usuario: OWNER_ID, estado } : null);
  pedidoService.update = async (id, data) => {
    updates.push({ id, data });
    return { _id: id, ...data };
  };
  return updates;
};

const statusRequest = ({ role = 'minorista', userId = OWNER_ID, nuevoEstado }) => ({
  userId,
  userRole: role,
  params: { id: ORDER_ID },
  body: { nuevoEstado },
});

const originalStatusFns = { findById: pedidoService.findById, update: pedidoService.update };

afterEach(() => {
  pedidoService.findById = originalStatusFns.findById;
  pedidoService.update = originalStatusFns.update;
});

test('modificarEstadoPedido forbids the owner from completing their own order', async () => {
  const updates = stubOrder('Pendiente');

  const { err } = await invoke(modificarEstadoPedido, statusRequest({ nuevoEstado: 'Completado' }));

  assert.equal(err.statusCode, 403);
  assert.equal(err.code, 'FORBIDDEN');
  assert.deepEqual(updates, []);
});

test('modificarEstadoPedido forbids the owner from reopening a cancelled order', async () => {
  const updates = stubOrder('Cancelado');

  const { err } = await invoke(modificarEstadoPedido, statusRequest({ nuevoEstado: 'Pendiente' }));

  assert.equal(err.statusCode, 403);
  assert.equal(err.code, 'FORBIDDEN');
  assert.deepEqual(updates, []);
});

test('modificarEstadoPedido lets the owner cancel a pending order', async () => {
  const updates = stubOrder('Pendiente');

  const { res, err } = await invoke(modificarEstadoPedido, statusRequest({ nuevoEstado: 'Cancelado' }));

  assert.equal(err, undefined);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(updates, [{ id: ORDER_ID, data: { estado: 'Cancelado' } }]);
});

test('modificarEstadoPedido refuses an owner cancel of a non-pending order with 400 INVALID_STATE', async () => {
  const updates = stubOrder('Completado');

  const { res } = await invoke(modificarEstadoPedido, statusRequest({ nuevoEstado: 'Cancelado' }));

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'INVALID_STATE');
  assert.deepEqual(updates, []);
});

test('modificarEstadoPedido forbids a user who does not own the order', async () => {
  const updates = stubOrder('Pendiente');

  const { err } = await invoke(
    modificarEstadoPedido,
    statusRequest({ userId: '64b7f0c2a1b2c3d4e5f60712', nuevoEstado: 'Cancelado' })
  );

  assert.equal(err.statusCode, 403);
  assert.deepEqual(updates, []);
});

test('modificarEstadoPedido keeps full status control for admins', async () => {
  const updates = stubOrder('Cancelado');

  const { res, err } = await invoke(
    modificarEstadoPedido,
    statusRequest({ role: 'admin', userId: '64b7f0c2a1b2c3d4e5f60701', nuevoEstado: 'Completado' })
  );

  assert.equal(err, undefined);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(updates, [{ id: ORDER_ID, data: { estado: 'Completado' } }]);
});
