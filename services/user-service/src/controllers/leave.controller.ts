import { isValidObjectId } from 'mongoose';
import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { LeaveApplication } from '../models/LeaveApplication';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const applyLeave = asyncHandler(async (req, res) => {
  const { userId, schoolId, role } = (req as AuthenticatedRequest).user;
  const { leaveType, startDate, endDate, reason } = req.body;

  const leave = await LeaveApplication.create({
    schoolId,
    userId,
    role,
    leaveType,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    reason,
  });

  return ApiResponse.success(res, 201, leave, 'Leave application submitted successfully');
});

export const getMyLeaves = asyncHandler(async (req, res) => {
  const { userId } = (req as AuthenticatedRequest).user;
  const leaves = await LeaveApplication.find({ userId }).sort({ createdAt: -1 });
  return ApiResponse.success(res, 200, leaves, 'Leaves fetched successfully');
});

export const getAllLeaves = asyncHandler(async (req, res) => {
  const { schoolId } = (req as AuthenticatedRequest).user;
  const leaves = await LeaveApplication.find({ schoolId }).sort({ createdAt: -1 });
  return ApiResponse.success(res, 200, leaves, 'All leaves fetched successfully');
});

export const updateLeaveStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // approved, rejected
  const { userId: approverId, schoolId } = (req as AuthenticatedRequest).user;

  if (!isValidObjectId(id)) throw new ApiError(404, 'Leave application not found');

  const leave = await LeaveApplication.findOneAndUpdate(
    { _id: id, schoolId },
    { status, approvedBy: approverId },
    { new: true, runValidators: true },
  );
  if (!leave) throw new ApiError(404, 'Leave application not found');

  return ApiResponse.success(res, 200, leave, `Leave ${status} successfully`);
});
