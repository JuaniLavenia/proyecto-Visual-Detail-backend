const { validationResult } = require("express-validator");

const requestValidation = (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty())
    return res.status(400).json({ errors: result.array() });
  next();
};

const errorMidleware = (err, req, res, next) => {
  console.log("Error", err);
  res.status(500);
  res.json({ message: "Internal server error" });
};

module.exports = { requestValidation, errorMidleware };
