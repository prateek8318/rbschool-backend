"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateParent = exports.getParentById = void 0;
const shared_1 = require("@rbschool/shared");
const ParentProfile_1 = require("../models/ParentProfile");
const Student_1 = require("../models/Student");
exports.getParentById = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const parent = await ParentProfile_1.ParentProfile.findOne({ _id: req.params.id, schoolId });
    if (!parent)
        throw new shared_1.ApiError(404, 'Parent not found');
    const children = await Student_1.Student.find({ _id: { $in: parent.childStudentIds }, schoolId });
    return shared_1.ApiResponse.success(res, 200, { ...parent.toObject(), children }, 'Parent fetched successfully');
});
exports.updateParent = (0, shared_1.asyncHandler)(async (req, res) => {
    const schoolId = req.user.schoolId;
    const parent = await ParentProfile_1.ParentProfile.findOneAndUpdate({ _id: req.params.id, schoolId }, req.body, { new: true });
    if (!parent)
        throw new shared_1.ApiError(404, 'Parent not found');
    return shared_1.ApiResponse.success(res, 200, parent, 'Parent updated successfully');
});
