"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpClient = void 0;
const axios_1 = __importDefault(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
exports.httpClient = axios_1.default.create({
    timeout: 5000,
});
(0, axios_retry_1.default)(exports.httpClient, {
    retries: 3,
    retryDelay: axios_retry_1.default.exponentialDelay,
    retryCondition: (error) => axios_retry_1.default.isNetworkOrIdempotentRequestError(error) || error.code === "ECONNABORTED",
});
