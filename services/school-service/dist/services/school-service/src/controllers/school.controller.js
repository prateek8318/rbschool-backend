"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLogo = exports.updateSettings = exports.getSettings = exports.updateSchool = exports.getSchool = exports.createSchool = void 0;
const shared_1 = require("@rbschool/shared");
const School_1 = require("../models/School");
exports.createSchool = (0, shared_1.asyncHandler)(async (req, res) => {
    const school = await School_1.School.create(req.body);
    return shared_1.ApiResponse.success(res, 201, school, 'School created successfully');
});
exports.getSchool = (0, shared_1.asyncHandler)(async (req, res) => {
    const school = await School_1.School.findById(req.params.id);
    if (!school)
        throw new shared_1.ApiError(404, 'School not found');
    return shared_1.ApiResponse.success(res, 200, school, 'School fetched successfully');
});
exports.updateSchool = (0, shared_1.asyncHandler)(async (req, res) => {
    const { role, schoolId } = req.user;
    if (role !== 'admin' || schoolId !== req.params.id)
        throw new shared_1.ApiError(403, 'Only admin of this school can update');
    const school = await School_1.School.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!school)
        throw new shared_1.ApiError(404, 'School not found');
    return shared_1.ApiResponse.success(res, 200, school, 'School updated successfully');
});
exports.getSettings = (0, shared_1.asyncHandler)(async (req, res) => {
    const school = await School_1.School.findById(req.params.id);
    if (!school)
        throw new shared_1.ApiError(404, 'School not found');
    return shared_1.ApiResponse.success(res, 200, school.settings, 'School settings fetched successfully');
});
exports.updateSettings = (0, shared_1.asyncHandler)(async (req, res) => {
    const { role, schoolId } = req.user;
    if (role !== 'admin' || schoolId !== req.params.id)
        throw new shared_1.ApiError(403, 'Only admin of this school can update settings');
    const school = await School_1.School.findByIdAndUpdate(req.params.id, { $set: { settings: req.body } }, { new: true });
    if (!school)
        throw new shared_1.ApiError(404, 'School not found');
    return shared_1.ApiResponse.success(res, 200, school.settings, 'School settings updated successfully');
});
exports.uploadLogo = (0, shared_1.asyncHandler)(async (req, res) => {
    const { role, schoolId } = req.user;
    if (role !== 'admin' || schoolId !== req.params.id)
        throw new shared_1.ApiError(403, 'Only admin of this school can upload logo');
    const file = req.file;
    if (!file)
        throw new shared_1.ApiError(400, 'Logo file is required');
    const logoUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const school = await School_1.School.findByIdAndUpdate(req.params.id, { $set: { logoUrl } }, { new: true });
    if (!school)
        throw new shared_1.ApiError(404, 'School not found');
    return shared_1.ApiResponse.success(res, 200, { logoUrl: school.logoUrl }, 'School logo uploaded successfully');
});
