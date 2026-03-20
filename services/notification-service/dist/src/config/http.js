"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.academicHttpClient = exports.userHttpClient = void 0;
const axios_1 = __importDefault(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const env_1 = require("./env");
exports.userHttpClient = axios_1.default.create({
    baseURL: env_1.env.USER_SERVICE_URL,
    timeout: 5000,
});
exports.academicHttpClient = axios_1.default.create({
    baseURL: env_1.env.ACADEMIC_SERVICE_URL,
    timeout: 5000,
});
(0, axios_retry_1.default)(exports.userHttpClient, {
    retries: 3,
    retryDelay: axios_retry_1.default.exponentialDelay,
    retryCondition: (error) => axios_retry_1.default.isNetworkOrIdempotentRequestError(error) || error.code === "ECONNABORTED",
});
(0, axios_retry_1.default)(exports.academicHttpClient, {
    retries: 3,
    retryDelay: axios_retry_1.default.exponentialDelay,
    retryCondition: (error) => axios_retry_1.default.isNetworkOrIdempotentRequestError(error) || error.code === "ECONNABORTED",
});
