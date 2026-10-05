/**
 * Auth Controller
 * Handles HTTP requests for authentication
 * Delegates to AuthService for business logic
 */

const authService = require("../services/auth.service");
const passwordResetService = require("../services/password-reset.service");
const { asyncHandler } = require("../middleware/error.middleware");
const { success } = require("../utils/response-formatter");

const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const result = await authService.login(email, password);

  res.json(
    success(
      {
        userId: result.user._id,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        role: result.user.role,
        user: result.user,
      },
      "Login exitoso"
    )
  );
});

const register = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const result = await authService.register(email, password);

  res.status(201).json(
    success(
      {
        userId: result.user._id,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        role: result.user.role,
        user: result.user,
      },
      "Registro exitoso"
    )
  );
});

const refresh = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  const tokens = await authService.refresh(refreshToken);

  res.json(success(tokens, "Token refrescado"));
});

const logout = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  await authService.logout(refreshToken);

  res.json(success(null, "Logout exitoso"));
});

const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  // Same response whether or not the e-mail exists (no account enumeration)
  await passwordResetService.requestPasswordReset(email);

  res.json(
    success(
      null,
      "Si el email está registrado, te enviamos un link para restablecer tu contraseña."
    )
  );
});

const resetPassword = asyncHandler(async (req, res, next) => {
  const { id, token } = req.params;
  const { password } = req.body;

  await passwordResetService.resetPassword(id, token, password);

  res.json(success(null, "Contraseña restablecida. Ya podés iniciar sesión."));
});

module.exports = {
  login,
  register,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
};
