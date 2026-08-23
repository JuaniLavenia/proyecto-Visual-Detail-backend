const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeTaxonomyValue,
  validateTaxonomySelection,
  normalizeTaxonomyLookup,
} = require("./product.service");

test("normalizeTaxonomyValue keeps the canonical taxonomy name when the slug is used", () => {
  const normalized = normalizeTaxonomyValue("toxic-shine", {
    name: "Toxic Shine",
    slug: "toxic-shine",
  });

  assert.equal(normalized, "Toxic Shine");
});

test("validateTaxonomySelection rejects values that are not present in the active taxonomy", () => {
  const registry = [
    { name: "Toxic Shine", slug: "toxic-shine", isActive: true },
    { name: "Línea Profesional", slug: "linea-profesional", isActive: true },
  ];

  assert.equal(
    validateTaxonomySelection("brand", "toxic-shine", registry),
    "Toxic Shine",
  );

  assert.throws(
    () => validateTaxonomySelection("brand", "marca no existe", registry),
    /no existe/i,
  );
});

test("normalizeTaxonomyLookup treats slug and spaced names as the same taxonomy value", () => {
  assert.equal(normalizeTaxonomyLookup("toxic-shine"), "toxic shine");
  assert.equal(normalizeTaxonomyLookup("Toxic Shine"), "toxic shine");
  assert.equal(
    normalizeTaxonomyLookup("línea_profesional"),
    "linea profesional",
  );
});
