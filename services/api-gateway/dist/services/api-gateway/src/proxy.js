"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServiceProxy = void 0;
const http_proxy_middleware_1 = require("http-proxy-middleware");
const buildServiceProxy = (target, prefix) => (0, http_proxy_middleware_1.createProxyMiddleware)({
    target,
    changeOrigin: true,
    pathRewrite: (path) => path.replace(new RegExp(`^/api/${prefix}`), `/${prefix}`),
    proxyTimeout: 5000,
    on: {
        proxyReq(proxyReq, req) {
            if (req.headers["x-user-id"]) {
                proxyReq.setHeader("x-user-id", String(req.headers["x-user-id"]));
            }
            if (req.headers["x-school-id"]) {
                proxyReq.setHeader("x-school-id", String(req.headers["x-school-id"]));
            }
            if (req.headers["x-user-role"]) {
                proxyReq.setHeader("x-user-role", String(req.headers["x-user-role"]));
            }
        },
    },
});
exports.buildServiceProxy = buildServiceProxy;
