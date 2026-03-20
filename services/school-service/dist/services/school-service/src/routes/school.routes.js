"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const multer_1 = __importDefault(require("multer"));
const school_controller_1 = require("../controllers/school.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.post('/schools', [
    (0, express_validator_1.body)('name').isString().notEmpty(),
    (0, express_validator_1.body)('board').isIn(['CBSE', 'ICSE', 'State']),
    (0, express_validator_1.body)('address').isString().notEmpty(),
    (0, express_validator_1.body)('phone').isString().notEmpty(),
], error_middleware_1.validateRequest, school_controller_1.createSchool);
router.get('/schools/:id', [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, school_controller_1.getSchool);
router.put('/schools/:id', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, school_controller_1.updateSchool);
router.get('/schools/:id/settings', [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, school_controller_1.getSettings);
router.put('/schools/:id/settings', auth_middleware_1.requireServiceAuth, [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, school_controller_1.updateSettings);
router.post('/schools/:id/upload-logo', auth_middleware_1.requireServiceAuth, upload.single('logo'), [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, school_controller_1.uploadLogo);
router.post('/internal/schools', [
    (0, express_validator_1.body)('name').isString().notEmpty(),
    (0, express_validator_1.body)('board').isIn(['CBSE', 'ICSE', 'State']),
    (0, express_validator_1.body)('address').isString().notEmpty(),
    (0, express_validator_1.body)('phone').isString().notEmpty(),
], error_middleware_1.validateRequest, school_controller_1.createSchool);
router.get('/internal/schools/:id', [(0, express_validator_1.param)('id').isMongoId()], error_middleware_1.validateRequest, school_controller_1.getSchool);
exports.default = router;
