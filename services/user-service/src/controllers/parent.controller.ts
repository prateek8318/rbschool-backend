import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ParentProfile } from '../models/ParentProfile';
import { Student } from '../models/Student';

export const getParentById = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const parent = await ParentProfile.findOne({ _id: req.params.id, schoolId });
  if (!parent) throw new ApiError(404, 'Parent not found');

  const children = await Student.find({ _id: { $in: parent.childStudentIds }, schoolId });
  return ApiResponse.success(res, 200, { ...parent.toObject(), children }, 'Parent fetched successfully');
});

export const updateParent = asyncHandler(async (req, res) => {
  const schoolId = (req as AuthenticatedRequest).user.schoolId;
  const parent = await ParentProfile.findOneAndUpdate({ _id: req.params.id, schoolId }, req.body, { new: true });
  if (!parent) throw new ApiError(404, 'Parent not found');
  return ApiResponse.success(res, 200, parent, 'Parent updated successfully');
});
