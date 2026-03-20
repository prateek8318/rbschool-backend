"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireServiceAuth = void 0;
const shared_1 = require("@rbschool/shared");
const requireServiceAuth = (req, _res, next) => {
    const userId = req.header('x-user-id');
    const role = req.header('x-user-role');
    const schoolId = req.header('x-school-id');
    if (!userId || !role || !schoolId) {
        next(new shared_1.ApiError(401, 'Unauthorized'));
        return;
    }
    req.user = { userId, role, schoolId };
    next();
};
exports.requireServiceAuth = requireServiceAuth;
