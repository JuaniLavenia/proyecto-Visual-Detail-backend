/**
 * Mailer
 * Thin wrapper around a nodemailer SMTP transport built from config.
 * The transport is created lazily so tests can replace it with setTransport().
 */

const nodemailer = require('nodemailer');
const config = require('../config');

let transport = null;

const createTransport = () => {
  const user = config.get('smtp.user');
  const pass = config.get('smtp.pass');

  return nodemailer.createTransport({
    host: config.get('smtp.host'),
    port: config.get('smtp.port'),
    secure: config.get('smtp.secure'),
    ...(user && { auth: { user, pass } }),
  });
};

const getTransport = () => {
  if (!transport) {
    transport = createTransport();
  }
  return transport;
};

/**
 * Replace the transport (tests) or reset it with null.
 */
const setTransport = (customTransport) => {
  transport = customTransport;
};

const sendMail = ({ to, subject, html, text }) =>
  getTransport().sendMail({
    from: config.get('smtp.from'),
    to,
    subject,
    html,
    text,
  });

module.exports = {
  sendMail,
  setTransport,
};
