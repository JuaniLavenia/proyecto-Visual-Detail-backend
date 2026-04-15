/**
 * Response formatter utility
 * Provides consistent response format: { success, data, error }
 */

const success = (data = null, message = null) => {
  const response = { success: true };
  if (data !== null) {
    response.data = data;
  }
  if (message !== null) {
    response.message = message;
  }
  return response;
};

const error = (message, code = null, statusCode = 500) => {
  const response = { success: false, error: { message } };
  if (code !== null) {
    response.error.code = code;
  }
  response.error.statusCode = statusCode;
  return response;
};

const paginated = (data, pagination) => {
  return {
    success: true,
    data,
    pagination
  };
};

module.exports = {
  success,
  error,
  paginated
};