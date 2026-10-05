const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const config = require('../config');
const mailer = require('./mailer');

afterEach(() => {
  mailer.setTransport(null);
});

test('sendMail sends through the transport using the configured sender', async () => {
  let sent;
  mailer.setTransport({
    sendMail: async (options) => {
      sent = options;
      return { messageId: 'abc' };
    },
  });

  const info = await mailer.sendMail({
    to: 'user@mail.com',
    subject: 'Asunto',
    html: '<p>Hola</p>',
    text: 'Hola',
  });

  assert.deepEqual(sent, {
    from: config.get('smtp.from'),
    to: 'user@mail.com',
    subject: 'Asunto',
    html: '<p>Hola</p>',
    text: 'Hola',
  });
  assert.equal(info.messageId, 'abc');
});

test('sendMail propagates transport failures', async () => {
  mailer.setTransport({
    sendMail: async () => {
      throw new Error('smtp down');
    },
  });

  await assert.rejects(
    mailer.sendMail({ to: 'user@mail.com', subject: 's', html: 'h', text: 't' }),
    /smtp down/
  );
});

test('config exposes Brevo SMTP defaults and the frontend URL', () => {
  assert.equal(typeof config.get('smtp.secure'), 'boolean');
  assert.equal(typeof config.get('smtp.from'), 'string');
  assert.ok(new URL(config.get('app.frontendUrl')));
});
