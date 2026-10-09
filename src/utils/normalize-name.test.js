const { test } = require('node:test');
const assert = require('node:assert/strict');

const { normalizeName } = require('./normalize-name');

for (const [label, input, expected] of [
  ['trims both ends', '  Cera X  ', 'Cera X'],
  ['collapses inner runs of whitespace', 'Cera   para\t\tautos', 'Cera para autos'],
  ['uppercases a lowercase first letter', 'cera x', 'Cera x'],
  ['uppercases an accented first letter', 'ámbar', 'Ámbar'],
  ['uppercases ñ', 'ñandú', 'Ñandú'],
  ['keeps the rest as typed', 'kIT PARA llantas', 'KIT PARA llantas'],
  ['keeps an all-uppercase name', 'KIT PARA LLANTAS', 'KIT PARA LLANTAS'],
  ['leaves a leading digit alone', '3m cinta', '3m cinta'],
  ['leaves a leading symbol alone', '  #1 shampoo ', '#1 shampoo'],
  ['returns an empty string for blank input', '   ', ''],
]) {
  test(`normalizeName ${label}`, () => {
    assert.equal(normalizeName(input), expected);
  });
}

test('normalizeName returns non-strings unchanged', () => {
  const obj = { a: 1 };
  assert.equal(normalizeName(undefined), undefined);
  assert.equal(normalizeName(null), null);
  assert.equal(normalizeName(42), 42);
  assert.equal(normalizeName(obj), obj);
});

test('normalizeName is idempotent', () => {
  const once = normalizeName('  ámbar   cera ');
  assert.equal(normalizeName(once), once);
});
