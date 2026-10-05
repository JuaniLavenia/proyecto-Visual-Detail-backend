const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const config = require('../config');
const User = require('../models/User');
const mailer = require('../utils/mailer');
const passwordResetService = require('./password-reset.service');

const USER_ID = '64b7f0c2a1b2c3d4e5f60718';
const PASSWORD_HASH = '$2a$12$currenthash';

const original = {
  findOne: User.findOne,
  findById: User.findById,
  sendMail: mailer.sendMail,
  consoleError: console.error,
};

let sentMails;
let fakeUser;

const makeUser = () => ({
  id: USER_ID,
  email: 'user@mail.com',
  password: PASSWORD_HASH,
  refreshToken: 'stored-refresh',
  saved: false,
  async save() {
    this.saved = true;
    return this;
  },
});

const tokenFor = (user, options = { expiresIn: '15m' }) =>
  jwt.sign({ uid: user.id }, config.get('jwt.secret') + user.password, options);

beforeEach(() => {
  sentMails = [];
  fakeUser = makeUser();
  User.findOne = async (query) => (query.email === fakeUser.email ? fakeUser : null);
  User.findById = async (id) => (id === fakeUser.id ? fakeUser : null);
  mailer.sendMail = async (mail) => {
    sentMails.push(mail);
    return { messageId: 'id' };
  };
  console.error = () => {};
});

afterEach(() => {
  User.findOne = original.findOne;
  User.findById = original.findById;
  mailer.sendMail = original.sendMail;
  console.error = original.consoleError;
});

// ---------- requestPasswordReset ----------

test('requestPasswordReset sends a mail with a frontend reset link for a known email', async () => {
  await passwordResetService.requestPasswordReset('  USER@mail.com ');

  assert.equal(sentMails.length, 1);
  const [mail] = sentMails;
  assert.equal(mail.to, 'user@mail.com');
  assert.ok(mail.subject);
  assert.ok(mail.text);

  // Token travels as a query param: JWTs contain dots, and SPA dev servers
  // (Vite) treat a dotted last path segment as a static file and return 404.
  const prefix = `${config.get('app.frontendUrl')}/reset/${USER_ID}?token=`;
  const match = mail.html.match(/href="([^"]+)"/);
  assert.ok(match, 'html contains a link');
  assert.ok(match[1].startsWith(prefix));
  assert.ok(mail.text.includes(match[1]));

  const token = decodeURIComponent(match[1].slice(prefix.length));
  const decoded = jwt.verify(token, config.get('jwt.secret') + PASSWORD_HASH);
  assert.equal(decoded.uid, USER_ID);
  assert.ok(decoded.exp - decoded.iat <= 15 * 60);
  assert.ok(!mail.html.includes('data-bs-'));
});

test('requestPasswordReset resolves silently for an unknown email', async () => {
  await assert.doesNotReject(passwordResetService.requestPasswordReset('nobody@mail.com'));
  assert.equal(sentMails.length, 0);
});

test('requestPasswordReset swallows SMTP failures', async () => {
  mailer.sendMail = async () => {
    throw new Error('smtp down');
  };

  await assert.doesNotReject(passwordResetService.requestPasswordReset('user@mail.com'));
});

test('requestPasswordReset resolves silently without mailing an inactive user', async () => {
  fakeUser.isActive = false;

  await assert.doesNotReject(passwordResetService.requestPasswordReset('user@mail.com'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sentMails.length, 0);
});

// ---------- sendResetLinkToUser (admin) ----------

test('sendResetLinkToUser sends the reset mail to the user', async () => {
  await passwordResetService.sendResetLinkToUser(USER_ID);

  assert.equal(sentMails.length, 1);
  assert.equal(sentMails[0].to, 'user@mail.com');
});

test('sendResetLinkToUser rejects an unknown user with 404 USER_NOT_FOUND', async () => {
  await assert.rejects(passwordResetService.sendResetLinkToUser('64b7f0c2a1b2c3d4e5f60799'), {
    statusCode: 404,
    code: 'USER_NOT_FOUND',
  });
});

test('sendResetLinkToUser rejects an inactive user with 409 USER_INACTIVE and sends nothing', async () => {
  fakeUser.isActive = false;

  await assert.rejects(passwordResetService.sendResetLinkToUser(USER_ID), {
    statusCode: 409,
    code: 'USER_INACTIVE',
  });
  assert.equal(sentMails.length, 0);
});

test('sendResetLinkToUser surfaces SMTP failures as 502 MAIL_SEND_FAILED', async () => {
  mailer.sendMail = async () => {
    throw new Error('smtp down');
  };

  await assert.rejects(passwordResetService.sendResetLinkToUser(USER_ID), {
    statusCode: 502,
    code: 'MAIL_SEND_FAILED',
  });
});

// ---------- resetPassword ----------

test('resetPassword sets the new password, revokes the refresh token and saves', async () => {
  const token = tokenFor(fakeUser);

  await passwordResetService.resetPassword(USER_ID, token, 'nueva123');

  assert.equal(fakeUser.password, 'nueva123');
  assert.equal(fakeUser.refreshToken, null);
  assert.equal(fakeUser.saved, true);
});

test('resetPassword rejects an expired token with 400 RESET_TOKEN_EXPIRED', async () => {
  const token = tokenFor(fakeUser, { expiresIn: -10 });

  await assert.rejects(passwordResetService.resetPassword(USER_ID, token, 'nueva123'), {
    statusCode: 400,
    code: 'RESET_TOKEN_EXPIRED',
  });
  assert.equal(fakeUser.saved, false);
});

test('resetPassword rejects a token signed for an older password', async () => {
  const token = tokenFor({ id: USER_ID, password: 'old-hash' });

  await assert.rejects(passwordResetService.resetPassword(USER_ID, token, 'nueva123'), {
    statusCode: 400,
    code: 'INVALID_RESET_TOKEN',
  });
  assert.equal(fakeUser.saved, false);
});

test('resetPassword rejects a tampered token', async () => {
  await assert.rejects(passwordResetService.resetPassword(USER_ID, 'not-a-jwt', 'nueva123'), {
    statusCode: 400,
    code: 'INVALID_RESET_TOKEN',
  });
});

test('resetPassword rejects an unknown or malformed user id', async () => {
  const token = tokenFor(fakeUser);

  await assert.rejects(
    passwordResetService.resetPassword('64b7f0c2a1b2c3d4e5f60799', token, 'nueva123'),
    { statusCode: 400, code: 'INVALID_RESET_TOKEN' }
  );
  await assert.rejects(passwordResetService.resetPassword('bad-id', token, 'nueva123'), {
    statusCode: 400,
    code: 'INVALID_RESET_TOKEN',
  });
});

test('resetPassword rejects an inactive user with 403 USER_INACTIVE and keeps the password', async () => {
  const token = tokenFor(fakeUser);
  fakeUser.isActive = false;

  await assert.rejects(passwordResetService.resetPassword(USER_ID, token, 'nueva123'), {
    statusCode: 403,
    code: 'USER_INACTIVE',
  });
  assert.equal(fakeUser.password, PASSWORD_HASH);
  assert.equal(fakeUser.saved, false);
});

test('resetPassword accepts a 72 h invite token', async () => {
  const token = tokenFor(fakeUser, { expiresIn: '72h' });

  await passwordResetService.resetPassword(USER_ID, token, 'nueva123');

  assert.equal(fakeUser.password, 'nueva123');
  assert.equal(fakeUser.saved, true);
});

// ---------- sendInviteMail (admin-created users) ----------

test('sendInviteMail mails a welcome link valid for 72 h with the reset link format', async () => {
  await passwordResetService.sendInviteMail(fakeUser);

  assert.equal(sentMails.length, 1);
  const [mail] = sentMails;
  assert.equal(mail.to, 'user@mail.com');
  assert.match(mail.html, /Te crearon una cuenta en Visual Detail/);
  assert.match(mail.html, /72 horas/);
  assert.match(mail.text, /defin[ií] tu contraseña/i);

  const prefix = `${config.get('app.frontendUrl')}/reset/${USER_ID}?token=`;
  const match = mail.html.match(/href="([^"]+)"/);
  assert.ok(match[1].startsWith(prefix));
  assert.ok(mail.text.includes(match[1]));

  const token = decodeURIComponent(match[1].slice(prefix.length));
  const decoded = jwt.verify(token, config.get('jwt.secret') + PASSWORD_HASH);
  assert.equal(decoded.uid, USER_ID);
  assert.equal(decoded.exp - decoded.iat, 72 * 60 * 60);

  // The same token sets the password through the regular reset flow
  await passwordResetService.resetPassword(USER_ID, token, 'nueva123');
  assert.equal(fakeUser.saved, true);
});

test('sendInviteMail rejects when the mail cannot be sent', async () => {
  mailer.sendMail = async () => {
    throw new Error('smtp down');
  };

  await assert.rejects(passwordResetService.sendInviteMail(fakeUser));
});

test('resetPassword rejects a token issued for another user', async () => {
  const otherToken = jwt.sign(
    { uid: '64b7f0c2a1b2c3d4e5f60799' },
    config.get('jwt.secret') + PASSWORD_HASH,
    { expiresIn: '15m' }
  );

  await assert.rejects(passwordResetService.resetPassword(USER_ID, otherToken, 'nueva123'), {
    statusCode: 400,
    code: 'INVALID_RESET_TOKEN',
  });
});
