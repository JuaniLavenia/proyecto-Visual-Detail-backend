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
