const { validationResult } = require("express-validator");

// Validation errors follow one contract and never echo the submitted value
// (it may be a password): { success, error: { message, code, details } }
const requestValidation = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result
    .array({ onlyFirstError: true })
    .map((err) => ({ field: err.path ?? null, message: err.msg }));

  return res.status(400).json({
    success: false,
    error: {
      message: details[0].message,
      code: "VALIDATION_ERROR",
      details,
    },
  });
};

module.exports = { requestValidation };
