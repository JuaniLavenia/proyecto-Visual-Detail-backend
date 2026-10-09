/**
 * Pure planning for scripts/backfill-home-taxonomy.js.
 *
 * Keeps the home looking the same on the deploy that moves it to the DB:
 * - every active brand/category not yet marked gets `showOnHome: true`;
 * - the five home categories get the image the home used to hardcode, only
 *   while their `image` is empty (an image set in the admin is never touched).
 *
 * Only missing values are planned, so applying the plan and planning again
 * yields nothing.
 */

// Keyed by matchKey(name)
const HOME_CATEGORY_IMAGES = {
  exteriores:
    'https://static.wixstatic.com/media/5a2c8f_301295c3d8f74fb287c3699812ba9fa9~mv2.jpg/v1/fill/w_1196,h_474,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/5a2c8f_301295c3d8f74fb287c3699812ba9fa9~mv2.jpg',
  interiores:
    'https://static.wixstatic.com/media/5a2c8f_f16fb69ffc1c4805bf10a304f850af93~mv2.jpg/v1/fill/w_1152,h_457,al_c,q_85,enc_auto/5a2c8f_f16fb69ffc1c4805bf10a304f850af93~mv2.jpg',
  'linea profesional':
    'https://static.wixstatic.com/media/5a2c8f_b6f242cd8d0042688594f5474f8a3d12~mv2.jpg/v1/fill/w_1196,h_474,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/5a2c8f_b6f242cd8d0042688594f5474f8a3d12~mv2.jpg',
  'linea industrial':
    'https://static.wixstatic.com/media/5a2c8f_2491e8debfc54edfb758ef28a9ee2bb0~mv2.jpg/v1/fill/w_1196,h_474,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/5a2c8f_2491e8debfc54edfb758ef28a9ee2bb0~mv2.jpg',
  perfumes:
    'https://static.wixstatic.com/media/5a2c8f_060fe2e628f74b1fa4eeb7af95569662~mv2.jpg/v1/fill/w_1152,h_457,al_c,q_85,enc_auto/5a2c8f_060fe2e628f74b1fa4eeb7af95569662~mv2.jpg',
};

// Case-, accent- and spacing-insensitive name key ("Línea  Profesional" → "linea profesional")
const matchKey = (name) =>
  String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const hasImage = (doc) => typeof doc.image === 'string' && doc.image.trim() !== '';

const planDocs = (docs, images = {}) => {
  const changes = [];
  for (const doc of docs) {
    const set = {};

    if (doc.isActive === true && doc.showOnHome !== true) {
      set.showOnHome = true;
    }

    const image = images[matchKey(doc.name)];
    if (image && !hasImage(doc)) {
      set.image = image;
    }

    if (Object.keys(set).length > 0) {
      changes.push({ id: String(doc._id), name: doc.name, set });
    }
  }
  return changes;
};

const planHomeBackfill = ({ brands = [], categories = [] } = {}) => ({
  brands: planDocs(brands),
  categories: planDocs(categories, HOME_CATEGORY_IMAGES),
});

module.exports = { planHomeBackfill, HOME_CATEGORY_IMAGES, matchKey };
