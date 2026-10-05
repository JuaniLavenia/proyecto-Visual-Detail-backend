const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const User = require('../models/User');
const Order = require('../models/Order');
const CartItem = require('../models/Cart');
const Favorite = require('../models/Favorite');
const userService = require('./user.service');
const { buildUserFilter } = userService;

const original = {
  find: User.find,
  countDocuments: User.countDocuments,
  findById: User.findById,
  exists: User.exists,
  deleteOne: User.deleteOne,
  orderExists: Order.exists,
  cartDeleteMany: CartItem.deleteMany,
  favoriteDeleteMany: Favorite.deleteMany,
};

let received;
let countsByFilter;
let docsById;
let takenEmails;
let ordersByUser;

beforeEach(() => {
  received = { find: [], count: [], deleted: [], cartDeleted: [], favoritesDeleted: [], exists: [] };
  countsByFilter = {};
  docsById = {};
  takenEmails = new Set();
  ordersByUser = new Set();
  User.findById = async (id) => docsById[String(id)] ?? null;
  User.exists = async (filter) => {
    received.exists.push(filter);
    return takenEmails.has(filter.email) ? { _id: 'other' } : null;
  };
  User.deleteOne = async (filter) => {
    received.deleted.push(filter);
    return { deletedCount: 1 };
  };
  Order.exists = async (filter) => (ordersByUser.has(String(filter.usuario)) ? { _id: 'o1' } : null);
  CartItem.deleteMany = async (filter) => {
    received.cartDeleted.push(filter);
    return { deletedCount: 2 };
  };
  Favorite.deleteMany = async (filter) => {
    received.favoritesDeleted.push(filter);
    return { deletedCount: 1 };
  };
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
  User.findById = original.findById;
  User.exists = original.exists;
  User.deleteOne = original.deleteOne;
  Order.exists = original.orderExists;
  CartItem.deleteMany = original.cartDeleteMany;
  Favorite.deleteMany = original.favoriteDeleteMany;
  delete User.prototype.save;
});

const ACTOR_ID = '64b7f0c2a1b2c3d4e5f60701';
const TARGET_ID = '64b7f0c2a1b2c3d4e5f60702';
const ACTIVE_ADMINS_FILTER = JSON.stringify({ role: 'admin', isActive: { $ne: false } });

const addDoc = (overrides = {}) => {
  const doc = {
    _id: TARGET_ID,
    id: TARGET_ID,
    email: 'target@mail.com',
    name: 'Target',
    role: 'minorista',
    isActive: true,
    refreshToken: 'stored-refresh',
    saveCount: 0,
    async save() {
      this.saveCount += 1;
      return this;
    },
    toJSON() {
      const { email, name, role, isActive } = this;
      return { _id: this._id, email, name, role, isActive };
    },
    ...overrides,
  };
  docsById[String(doc._id)] = doc;
  return doc;
};

const setActiveAdmins = (count) => {
  countsByFilter[ACTIVE_ADMINS_FILTER] = count;
};

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

// ---------- createByAdmin ----------

const stubSave = () => {
  const saved = [];
  User.prototype.save = async function () {
    saved.push(this);
    return this;
  };
  return saved;
};

test('createByAdmin saves a normalized user with a random high-entropy password', async () => {
  const saved = stubSave();

  const user = await userService.createByAdmin({ email: ' Ana@Mail.com ', name: 'Ana', role: 'mayorista' });

  assert.equal(saved.length, 1, 'goes through save() so the pre-save hook hashes');
  assert.equal(user.email, 'ana@mail.com');
  assert.equal(user.name, 'Ana');
  assert.equal(user.role, 'mayorista');
  assert.match(user.password, /^[0-9a-f]{64}$/);
  assert.equal(user.toJSON().password, undefined);
  assert.deepEqual(received.exists, [{ email: 'ana@mail.com' }]);
});

test('createByAdmin defaults the role to minorista and never reuses a password', async () => {
  stubSave();

  const first = await userService.createByAdmin({ email: 'a@mail.com' });
  const second = await userService.createByAdmin({ email: 'b@mail.com' });

  assert.equal(first.role, 'minorista');
  assert.notEqual(first.password, second.password);
});

test('createByAdmin rejects a registered email with 409 EMAIL_IN_USE', async () => {
  const saved = stubSave();
  takenEmails.add('ana@mail.com');

  await assert.rejects(userService.createByAdmin({ email: 'ANA@mail.com' }), {
    statusCode: 409,
    code: 'EMAIL_IN_USE',
  });
  assert.equal(saved.length, 0);
});

test('createByAdmin maps a duplicate key race on save to 409 EMAIL_IN_USE', async () => {
  User.prototype.save = async () => {
    const err = new Error('E11000 duplicate key');
    err.name = 'MongoServerError';
    err.code = 11000;
    throw err;
  };

  await assert.rejects(userService.createByAdmin({ email: 'ana@mail.com' }), {
    statusCode: 409,
    code: 'EMAIL_IN_USE',
  });
});

// ---------- updateByAdmin ----------

test('updateByAdmin applies the changes through save() and returns the user', async () => {
  const doc = addDoc();

  const result = await userService.updateByAdmin(TARGET_ID, ACTOR_ID, { name: 'Nuevo', email: 'NEW@mail.com ' });

  assert.equal(doc.saveCount, 1);
  assert.equal(doc.name, 'Nuevo');
  assert.equal(doc.email, 'new@mail.com');
  assert.equal(doc.refreshToken, 'stored-refresh', 'profile edits keep the session');
  assert.deepEqual(received.exists, [{ email: 'new@mail.com', _id: { $ne: TARGET_ID } }]);
  assert.equal(result.email, 'new@mail.com');
});

test('updateByAdmin revokes the session when the role changes', async () => {
  const doc = addDoc();

  await userService.updateByAdmin(TARGET_ID, ACTOR_ID, { role: 'mayorista' });

  assert.equal(doc.role, 'mayorista');
  assert.equal(doc.refreshToken, null);
  assert.equal(doc.saveCount, 1);
});

test('updateByAdmin revokes the session when the user is deactivated', async () => {
  const doc = addDoc();

  await userService.updateByAdmin(TARGET_ID, ACTOR_ID, { isActive: false });

  assert.equal(doc.isActive, false);
  assert.equal(doc.refreshToken, null);
});

test('updateByAdmin reactivates without touching the session', async () => {
  const doc = addDoc({ isActive: false, refreshToken: null });

  await userService.updateByAdmin(TARGET_ID, ACTOR_ID, { isActive: true });

  assert.equal(doc.isActive, true);
  assert.equal(doc.saveCount, 1);
});

test('updateByAdmin rejects an email used by another user with 409 EMAIL_IN_USE', async () => {
  const doc = addDoc();
  takenEmails.add('taken@mail.com');

  await assert.rejects(userService.updateByAdmin(TARGET_ID, ACTOR_ID, { email: 'taken@mail.com' }), {
    statusCode: 409,
    code: 'EMAIL_IN_USE',
  });
  assert.equal(doc.saveCount, 0);
});

test('updateByAdmin rejects an unknown user with 404 USER_NOT_FOUND', async () => {
  await assert.rejects(userService.updateByAdmin(TARGET_ID, ACTOR_ID, { name: 'x' }), {
    statusCode: 404,
    code: 'USER_NOT_FOUND',
  });
});

// ---------- self guard ----------

test('an admin cannot deactivate, demote or delete their own account', async () => {
  const self = addDoc({ _id: ACTOR_ID, id: ACTOR_ID, role: 'admin' });
  setActiveAdmins(5);

  for (const change of [{ isActive: false }, { role: 'minorista' }]) {
    await assert.rejects(userService.updateByAdmin(ACTOR_ID, ACTOR_ID, change), {
      statusCode: 403,
      code: 'SELF_ACTION_FORBIDDEN',
    });
  }
  await assert.rejects(userService.deleteByAdmin(ACTOR_ID, ACTOR_ID), {
    statusCode: 403,
    code: 'SELF_ACTION_FORBIDDEN',
  });
  assert.equal(self.saveCount, 0);
  assert.deepEqual(received.deleted, []);
});

test('an admin can still edit the name and email of their own account', async () => {
  const self = addDoc({ _id: ACTOR_ID, id: ACTOR_ID, role: 'admin' });

  await userService.updateByAdmin(ACTOR_ID, ACTOR_ID, { name: 'Yo', role: 'admin', isActive: true });

  assert.equal(self.name, 'Yo');
  assert.equal(self.saveCount, 1);
  assert.equal(self.refreshToken, 'stored-refresh');
});

// ---------- last admin guard ----------

test('the last active admin cannot be demoted, deactivated or deleted', async () => {
  const lastAdmin = addDoc({ role: 'admin' });
  setActiveAdmins(1);

  for (const change of [{ role: 'mayorista' }, { isActive: false }]) {
    await assert.rejects(userService.updateByAdmin(TARGET_ID, ACTOR_ID, change), {
      statusCode: 409,
      code: 'LAST_ADMIN',
    });
  }
  await assert.rejects(userService.deleteByAdmin(TARGET_ID, ACTOR_ID), {
    statusCode: 409,
    code: 'LAST_ADMIN',
  });
  assert.equal(lastAdmin.saveCount, 0);
  assert.equal(lastAdmin.role, 'admin');
  assert.deepEqual(received.deleted, []);
  assert.ok(received.count.some((f) => JSON.stringify(f) === ACTIVE_ADMINS_FILTER));
});

test('an admin can be demoted while another active admin remains', async () => {
  const doc = addDoc({ role: 'admin' });
  setActiveAdmins(2);

  await userService.updateByAdmin(TARGET_ID, ACTOR_ID, { role: 'minorista' });

  assert.equal(doc.role, 'minorista');
  assert.equal(doc.refreshToken, null);
});

test('an inactive admin is not counted as the last admin', async () => {
  const doc = addDoc({ role: 'admin', isActive: false });
  setActiveAdmins(1);

  await userService.updateByAdmin(TARGET_ID, ACTOR_ID, { role: 'minorista' });

  assert.equal(doc.role, 'minorista');
});

// ---------- updateRole (PUT /users/:id/role retrofit) ----------

test('updateRole saves the new role and revokes the session', async () => {
  const doc = addDoc();

  const result = await userService.updateRole(TARGET_ID, ACTOR_ID, 'admin');

  assert.equal(doc.role, 'admin');
  assert.equal(doc.refreshToken, null);
  assert.equal(doc.saveCount, 1);
  assert.equal(result.role, 'admin');
});

test('updateRole applies the self and last-admin guards', async () => {
  addDoc({ _id: ACTOR_ID, id: ACTOR_ID, role: 'admin' });
  addDoc({ role: 'admin' });
  setActiveAdmins(1);

  await assert.rejects(userService.updateRole(ACTOR_ID, ACTOR_ID, 'minorista'), {
    code: 'SELF_ACTION_FORBIDDEN',
  });
  await assert.rejects(userService.updateRole(TARGET_ID, ACTOR_ID, 'minorista'), {
    code: 'LAST_ADMIN',
  });
});

// ---------- deleteByAdmin ----------

test('deleteByAdmin refuses a user with orders with 409 USER_HAS_ORDERS', async () => {
  addDoc();
  ordersByUser.add(TARGET_ID);

  await assert.rejects(userService.deleteByAdmin(TARGET_ID, ACTOR_ID), (err) => {
    assert.equal(err.statusCode, 409);
    assert.equal(err.code, 'USER_HAS_ORDERS');
    assert.match(err.message, /desactiv/i);
    return true;
  });
  assert.deepEqual(received.deleted, []);
  assert.deepEqual(received.cartDeleted, []);
});

test('deleteByAdmin removes a user without orders plus their cart and favorites', async () => {
  addDoc();

  await userService.deleteByAdmin(TARGET_ID, ACTOR_ID);

  assert.deepEqual(received.deleted, [{ _id: TARGET_ID }]);
  assert.deepEqual(received.cartDeleted, [{ userId: TARGET_ID }]);
  assert.deepEqual(received.favoritesDeleted, [{ userId: TARGET_ID }]);
});

test('deleteByAdmin rejects an unknown user with 404 USER_NOT_FOUND', async () => {
  await assert.rejects(userService.deleteByAdmin(TARGET_ID, ACTOR_ID), {
    statusCode: 404,
    code: 'USER_NOT_FOUND',
  });
});

test('legacy findAll and delete helpers are gone', () => {
  assert.equal(userService.findAll, undefined);
  assert.equal(userService.delete, undefined);
});
