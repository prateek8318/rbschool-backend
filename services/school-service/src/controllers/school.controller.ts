import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { School } from '../models/School';

export const createSchool = asyncHandler(async (req, res) => {
  const school = await School.create(req.body);
  return ApiResponse.success(res, 201, school, 'School created successfully');
});

export const getSchool = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) throw new ApiError(404, 'School not found');
  return ApiResponse.success(res, 200, school, 'School fetched successfully');
});

export const updateSchool = asyncHandler(async (req, res) => {
  const { role, schoolId } = (req as AuthenticatedRequest).user;
  if (role !== 'admin' || schoolId !== req.params.id) throw new ApiError(403, 'Only admin of this school can update');
  const school = await School.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!school) throw new ApiError(404, 'School not found');
  return ApiResponse.success(res, 200, school, 'School updated successfully');
});

export const getSettings = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) throw new ApiError(404, 'School not found');
  return ApiResponse.success(res, 200, school.settings, 'School settings fetched successfully');
});

export const updateSettings = asyncHandler(async (req, res) => {
  const { role, schoolId } = (req as AuthenticatedRequest).user;
  if (role !== 'admin' || schoolId !== req.params.id) throw new ApiError(403, 'Only admin of this school can update settings');
  const school = await School.findByIdAndUpdate(req.params.id, { $set: { settings: req.body } }, { new: true });
  if (!school) throw new ApiError(404, 'School not found');
  return ApiResponse.success(res, 200, school.settings, 'School settings updated successfully');
});

export const uploadLogo = asyncHandler(async (req, res) => {
  const { role, schoolId } = (req as AuthenticatedRequest).user;
  if (role !== 'admin' || schoolId !== req.params.id) throw new ApiError(403, 'Only admin of this school can upload logo');

  const file = req.file;
  if (!file) throw new ApiError(400, 'Logo file is required');

  const logoUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
  const school = await School.findByIdAndUpdate(req.params.id, { $set: { logoUrl } }, { new: true });
  if (!school) throw new ApiError(404, 'School not found');

  return ApiResponse.success(res, 200, { logoUrl: school.logoUrl }, 'School logo uploaded successfully');
});
