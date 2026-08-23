const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeFilters } = require("./filter-config.service");

test("normalizes filter order from the submitted array", () => {
  const filters = normalizeFilters([
    { key: "brand", label: "Marcas", isActive: true, sortOrder: 99 },
    { key: "category", label: "Categorías", isActive: false, sortOrder: -2 },
  ]);

  assert.deepEqual(filters, [
    { key: "brand", label: "Marcas", isActive: true, sortOrder: 0 },
    { key: "category", label: "Categorías", isActive: false, sortOrder: 1 },
  ]);
});

test("rejects unsupported and duplicated filter keys", () => {
  assert.throws(
    () => normalizeFilters([{ key: "price", label: "Precio", isActive: true }]),
    { code: "FILTER_KEY_NOT_ALLOWED" },
  );
  assert.throws(
    () =>
      normalizeFilters([
        { key: "brand", label: "Marcas", isActive: true },
        { key: "brand", label: "Marcas 2", isActive: true },
      ]),
    { code: "DUPLICATE_FILTER" },
  );
});

test("requires a real boolean for isActive", () => {
  assert.throws(
    () =>
      normalizeFilters([{ key: "brand", label: "Marcas", isActive: "true" }]),
    { code: "FILTER_ACTIVE_INVALID" },
  );
});
