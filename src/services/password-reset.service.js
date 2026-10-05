/**
 * Password Reset Service
 * Issues password reset links by e-mail and applies password resets.
 *
 * Reset tokens are JWTs signed with JWT_SECRET + the current password hash,
 * so a token stops working as soon as the password changes (single use).
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config');
const mailer = require('../utils/mailer');
const { sanitizeFindQuery } = require('../utils/query-sanitizer');
const { AppError } = require('../middleware/error.middleware');

const RESET_TOKEN_EXPIRY = '15m';

const invalidTokenError = () =>
  new AppError('El link de recuperación es inválido', 400, 'INVALID_RESET_TOKEN');

const buildResetMail = (link) => ({
  subject: 'Restablecer contraseña - Visual-Detailing',
  html: `<!DOCTYPE html>
<html lang="es">
  <body>
    <h1>¿Olvidaste tu contraseña?</h1>
    <p>¡No te preocupes! Te enviamos un link para que puedas restablecer tu contraseña. El link es válido por 15 minutos.</p>
    <p><a href="${link}">Hacé click acá para restablecer tu contraseña</a></p>
    <p>Si no solicitaste este cambio, podés ignorar este correo.</p>
    <p>¡Gracias por utilizar nuestros servicios!<br>Saludos,<br>El equipo de Visual-Detailing</p>
  </body>
</html>`,
  text: [
    '¿Olvidaste tu contraseña?',
    '',
    '¡No te preocupes! Usá el siguiente link para restablecer tu contraseña. El link es válido por 15 minutos:',
    link,
    '',
    'Si no solicitaste este cambio, podés ignorar este correo.',
    '',
    'Saludos,',
    'El equipo de Visual-Detailing',
  ].join('\n'),
});

class PasswordResetService {
  /**
   * Build the frontend reset link for a user
   */
  buildResetLink(user) {
    const token = jwt.sign({ uid: user.id }, config.get('jwt.secret') + user.password, {
      expiresIn: RESET_TOKEN_EXPIRY,
    });
    const baseUrl = config.get('app.frontendUrl').replace(/\/+$/, '');
    return `${baseUrl}/reset/${user.id}/${token}`;
  }

  /**
   * Send the reset mail. Rejects when the mail could not be sent.
   */
  async sendResetMail(user) {
    const { subject, html, text } = buildResetMail(this.buildResetLink(user));
    await mailer.sendMail({ to: user.email, subject, html, text });
  }

  /**
   * Public "forgot password" flow.
   * Always resolves so the response does not reveal whether the e-mail exists.
   */
  async requestPasswordReset(email) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne(sanitizeFindQuery({ email: normalizedEmail }));
    if (!user) {
      return;
    }

    try {
      await this.sendResetMail(user);
    } catch (err) {
      // Log only the failure reason, never credentials or the reset link
      console.error('Password reset mail failed:', err.code || err.message);
    }
  }

  /**
   * Admin flow: send the reset link to a given user.
   * Unlike the public flow, failures are surfaced to the caller.
   */
  async sendResetLinkToUser(id) {
    const user = mongoose.isValidObjectId(id) ? await User.findById(id) : null;
    if (!user) {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }

    try {
      await this.sendResetMail(user);
    } catch (err) {
      console.error('Password reset mail failed:', err.code || err.message);
      throw new AppError('No se pudo enviar el correo de recuperación', 502, 'MAIL_SEND_FAILED');
    }
  }

  /**
   * Apply a password reset and revoke the stored refresh token
   */
  async resetPassword(id, token, password) {
    const user = mongoose.isValidObjectId(id) ? await User.findById(id) : null;
    if (!user) {
      throw invalidTokenError();
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.get('jwt.secret') + user.password);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError('El link de recuperación expiró', 400, 'RESET_TOKEN_EXPIRED');
      }
      throw invalidTokenError();
    }

    if (decoded.uid !== user.id) {
      throw invalidTokenError();
    }

    // Must go through save() so the pre-save hook hashes the password
    user.password = password;
    user.refreshToken = null;
    await user.save();
  }
}

module.exports = new PasswordResetService();
