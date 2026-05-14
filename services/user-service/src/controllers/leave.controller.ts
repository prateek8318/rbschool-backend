import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const applyLeave = asyncHandler(async (req, res) => {
  const { userId, schoolId, role } = (req as AuthenticatedRequest).user;
  const { leaveType, startDate, endDate, reason } = req.body;

  const leave = await prisma.leaveApplication.create({
    data: {
      schoolId,
      userId,
      role,
      leaveType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
    },
  });

  return ApiResponse.success(res, 201, leave, 'Leave application submitted successfully');
});

export const getMyLeaves = asyncHandler(async (req, res) => {
  const { userId } = (req as AuthenticatedRequest).user;

  const leaves = await prisma.leaveApplication.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return ApiResponse.success(res, 200, leaves, 'Leaves fetched successfully');
});

export const getAllLeaves = asyncHandler(async (req, res) => {
  const { schoolId } = (req as AuthenticatedRequest).user;

  const leaves = await prisma.leaveApplication.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' },
  });

  return ApiResponse.success(res, 200, leaves, 'All leaves fetched successfully');
});

export const updateLeaveStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // approved, rejected
  const { userId: approverId } = (req as AuthenticatedRequest).user;

  const leave = await prisma.leaveApplication.update({
    where: { id },
    data: {
      status,
      approvedBy: approverId,
    },
  });

  return ApiResponse.success(res, 200, leave, `Leave ${status} successfully`);
});
