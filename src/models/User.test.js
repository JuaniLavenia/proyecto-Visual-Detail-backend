const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const User = require('./User');

const originalHash = bcrypt.hash;
const originalInsertOne = User.collection.insertOne;
const originalConsoleLog = console.log;

afterEach(() => {
  bcrypt.hash = originalHash;
  User.collection.insertOne = originalInsertOne;
  console.log = originalConsoleLog;
});

test('save fails when bcrypt cannot hash the password', async () => {
  bcrypt.hash = async () => {
    throw new Error('bcrypt boom');
  };
  // Never reached when the hook propagates the error; fails fast otherwise
  User.collection.insertOne = async () => {
    throw new Error('insert reached with an unhashed password');
  };
  console.log = () => {};

  const user = new User({ email: 'user@mail.com', password: 'plain-text' });

  await assert.rejects(() => user.save(), /bcrypt boom/);
});
