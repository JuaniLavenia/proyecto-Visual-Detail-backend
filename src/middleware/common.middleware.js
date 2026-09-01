const { validationResult } = require("express-validator");

const requestValidation = (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty())
    return res.status(400).json({ errors: result.array() });
  next();
};

module.exports = { requestValidation };
