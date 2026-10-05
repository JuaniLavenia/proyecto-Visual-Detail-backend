const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const User = require('../models/User');
const userService = require('./user.service');
const { buildUserFilter } = userService;

const original = { find: User.find, countDocuments: User.countDocuments };

let received;
let countsByFilter;

beforeEach(() => {
  received = { find: [], count: [] };
  countsByFilter = {};
  User.find = (filter) => {
    received.find.push(filter);
    const chain = {
      select: (projection) => {
        received.select = projection;
        return chain;
      },
      sort: (sort) => {
        received.sort = sort;
        return chain;
      },
      skip: (skip) => {
        received.skip = skip;
        return chain;
      },
      limit: (limit) => {
        received.limit = limit;
        return chain;
      },
      lean: async () => [{ _id: 'u1', email: 'a@mail.com' }],
    };
    return chain;
  };
  User.countDocuments = async (filter) => {
    received.count.push(filter);
    return countsByFilter[JSON.stringify(filter)] ?? 0;
  };
});

afterEach(() => {
  User.find = original.find;
  User.countDocuments = original.countDocuments;
});

// ---------- buildUserFilter ----------

test('buildUserFilter returns an empty filter without params', () => {
  assert.deepEqual(buildUserFilter(), {});
  assert.deepEqual(buildUserFilter({ search: '   ' }), {});
});

test('buildUserFilter matches email OR name with an escaped, case-insensitive search', () => {
  const filter = buildUserFilter({ search: ' a.b+ ' });

  const regex = { $regex: 'a\\.b\\+', $options: 'i' };
  assert.deepEqual(filter, { $or: [{ email: regex }, { name: regex }] });
  // The escaped pattern matches the literal text only
  assert.ok(new RegExp(regex.$regex, 'i').test('A.B+'));
  assert.ok(!new RegExp(regex.$regex, 'i').test('axbb'));
});

test('buildUserFilter filters by a known role and ignores unknown ones', () => {
  assert.deepEqual(buildUserFilter({ role: 'mayorista' }), { role: 'mayorista' });
  assert.deepEqual(buildUserFilter({ role: { $ne: 'x' } }), {});
});

test('buildUserFilter treats legacy users without isActive as active', () => {
  assert.deepEqual(buildUserFilter({ status: 'active' }), { isActive: { $ne: false } });
  assert.deepEqual(buildUserFilter({ status: 'inactive' }), { isActive: false });
  assert.deepEqual(buildUserFilter({ status: 'other' }), {});
});

test('buildUserFilter combines search, role and status', () => {
  const filter = buildUserFilter({ search: 'ana', role: 'admin', status: 'inactive' });

  assert.deepEqual(filter, {
    role: 'admin',
    isActive: false,
    $or: [
      { email: { $regex: 'ana', $options: 'i' } },
      { name: { $regex: 'ana', $options: 'i' } },
    ],
  });
});

// ---------- list ----------

test('list paginates with the same filter for find and count and hides secrets', async () => {
  countsByFilter[JSON.stringify({ role: 'minorista' })] = 45;

  const result = await userService.list({ page: 3, limit: 20, role: 'minorista' });

  assert.deepEqual(received.find, [{ role: 'minorista' }]);
  assert.deepEqual(received.count[0], { role: 'minorista' });
  assert.equal(received.skip, 40);
  assert.equal(received.limit, 20);
  assert.equal(received.select, '-password -refreshToken');
  assert.deepEqual(result.users, [{ _id: 'u1', email: 'a@mail.com' }]);
  assert.equal(result.total, 45);
  assert.equal(result.page, 3);
  assert.equal(result.limit, 20);
  assert.equal(result.totalPages, 3);
});

test('list defaults to page 1, limit 20 and newest first with an _id tie-break', async () => {
  const result = await userService.list();

  assert.equal(received.skip, 0);
  assert.equal(received.limit, 20);
  assert.deepEqual(received.sort, { createdAt: -1, _id: -1 });
  assert.equal(result.totalPages, 0);
});

test('list sorts by email when asked and falls back to newest for unknown sorts', async () => {
  await userService.list({ sort: 'email' });
  assert.deepEqual(received.sort, { email: 1, _id: 1 });

  await userService.list({ sort: 'password' });
  assert.deepEqual(received.sort, { createdAt: -1, _id: -1 });
});

// ---------- getCounts ----------

test('getCounts computes KPIs over all users, counting legacy users as active', async () => {
  countsByFilter[JSON.stringify({})] = 10;
  countsByFilter[JSON.stringify({ role: 'admin' })] = 2;
  countsByFilter[JSON.stringify({ role: 'mayorista' })] = 3;
  countsByFilter[JSON.stringify({ role: 'minorista' })] = 5;
  countsByFilter[JSON.stringify({ isActive: false })] = 4;

  const counts = await userService.getCounts();

  assert.deepEqual(counts, {
    total: 10,
    admins: 2,
    mayoristas: 3,
    minoristas: 5,
    active: 6,
    inactive: 4,
  });
});
