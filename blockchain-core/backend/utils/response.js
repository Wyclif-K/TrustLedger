// =============================================================================
// TrustLedger - API Response Helpers
// =============================================================================

'use strict';

function sendSuccess(res, data = {}, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

function sendCreated(res, data = {}, message = 'Created successfully') {
  return sendSuccess(res, data, message, 201);
}

function sendError(res, statusCode = 500, message = 'Internal server error', errors = null) {
  const body = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

function sendPaginated(res, data, total, page, limit) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page:       parseInt(page, 10),
      limit:      parseInt(limit, 10),
      totalPages: Math.ceil(total / limit),
    },
    timestamp: new Date().toISOString(),
  });
}

module.exports = { sendSuccess, sendCreated, sendError, sendPaginated };
