const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth.middleware");
const { isAdmin } = require("../middleware/admin.middleware");
const {
  getPublicConfig,
  getAdminConfig,
  updateConfig,
} = require("../controllers/filter-config.controller");

router.get("/filter-config/plp", getPublicConfig);
router.get("/filter-config/plp/admin", authenticate, isAdmin, getAdminConfig);
router.put("/filter-config/plp", authenticate, isAdmin, updateConfig);

module.exports = router;
