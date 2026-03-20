"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const shared_1 = require("@rbschool/shared");
const env_1 = require("./config/env");
const auth_middleware_1 = require("./middleware/auth.middleware");
const rateLimit_middleware_1 = require("./middleware/rateLimit.middleware");
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const proxy_routes_1 = __importDefault(require("./routes/proxy.routes"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: env_1.env.CORS_ORIGIN, credentials: true }));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(rateLimit_middleware_1.globalLimiter);
app.use('/api/auth', rateLimit_middleware_1.authLimiter);
app.use(auth_middleware_1.verifyGatewayAuth);
app.use(health_routes_1.default);
app.use(dashboard_routes_1.default);
app.use(proxy_routes_1.default);
app.use((error, _req, res, _next) => {
    if (error instanceof shared_1.ApiError) {
        return shared_1.ApiResponse.error(res, error.statusCode, error.message, error.errors);
    }
    return shared_1.ApiResponse.error(res, 500, 'Internal Server Error');
});
exports.default = app;
