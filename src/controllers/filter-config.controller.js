const { asyncHandler } = require("../middleware/error.middleware");
const { success } = require("../utils/response-formatter");
const filterConfigService = require("../services/filter-config.service");

const getPublicConfig = asyncHandler(async (req, res) => {
  res.json(success(await filterConfigService.getPublicConfig()));
});

const getAdminConfig = asyncHandler(async (req, res) => {
  res.json(success(await filterConfigService.getAdminConfig()));
});

const updateConfig = asyncHandler(async (req, res) => {
  res.json(
    success(
      await filterConfigService.updateConfig(req.body),
      "Configuración actualizada",
    ),
  );
});

module.exports = { getPublicConfig, getAdminConfig, updateConfig };
