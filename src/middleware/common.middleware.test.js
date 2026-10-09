const { test } = require('node:test');
const assert = require('node:assert/strict');
const { body } = require('express-validator');

const { requestValidation } = require('./common.middleware');

const run = async (rules, reqBody) => {
  const req = { body: reqBody };
  for (const rule of rules) {
    await rule.run(req);
  }
  const res = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let nextCalled = false;
  requestValidation(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
};

const rules = [
  body('email').isEmail().withMessage('El correo es incorrecto'),
  body('password').isLength({ min: 8 }).withMessage('La contraseña es corta').isAlpha().withMessage('Solo letras'),
];

test('calls next when there are no validation errors', async () => {
  const { res, nextCalled } = await run(rules, { email: 'a@mail.com', password: 'abcdefgh' });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test('answers 400 with the VALIDATION_ERROR contract', async () => {
  const { res, nextCalled } = await run(rules, { email: 'nope', password: 'abc' });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, {
    success: false,
    error: {
      message: 'El correo es incorrecto',
      code: 'VALIDATION_ERROR',
      details: [
        { field: 'email', message: 'El correo es incorrecto' },
        { field: 'password', message: 'La contraseña es corta' },
      ],
    },
  });
});

test('never echoes the submitted value', async () => {
  const { res } = await run(rules, { email: 'nope', password: 'secret1' });

  assert.ok(!JSON.stringify(res.payload).includes('secret1'));
  assert.ok(!JSON.stringify(res.payload).includes('"value"'));
});
