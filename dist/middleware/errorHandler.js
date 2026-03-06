"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const errorHandler = (err, req, res, _next) => {
    let error = { ...err };
    error.message = err.message;
    logger_1.logger.error({
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = { message, statusCode: 404 };
    }
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = { message, statusCode: 400 };
    }
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map((val) => val.message);
        error = { message: message.join(', '), statusCode: 400 };
    }
    if (err.response && err.response.status) {
        const message = `WordPress API Error: ${err.response.statusText || 'Unknown error'}`;
        error = { message, statusCode: err.response.status };
    }
    if (err.response && err.response.data && err.response.data.error) {
        const message = `Slack API Error: ${err.response.data.error}`;
        error = { message, statusCode: err.response.status || 400 };
    }
    const statusCode = error.statusCode || 500;
    const response = {
        success: false,
        error: error.message || 'Server Error'
    };
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }
    res.status(statusCode).json(response);
};
exports.errorHandler = errorHandler;
exports.default = errorHandler;
//# sourceMappingURL=errorHandler.js.map