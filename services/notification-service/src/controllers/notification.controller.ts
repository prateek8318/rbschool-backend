import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Notification } from '../models/Notification';

export const getMyNotifications = asyncHandler(async (req, res) => {
  const { userId, schoolId } = (req as AuthenticatedRequest).user;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const query = { userId, schoolId };
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(query),
    Notification.countDocuments({ userId, schoolId, isRead: false }),
  ]);
  return ApiResponse.success(res, 200, { notifications, unreadCount }, 'Notifications fetched successfully', {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

export const markAsRead = asyncHandler(async (req, res) => {
  const { userId, schoolId } = (req as AuthenticatedRequest).user;
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, userId, schoolId }, { $set: { isRead: true } }, { new: true });
  if (!notification) throw new ApiError(404, 'Notification not found');
  return ApiResponse.success(res, 200, notification, 'Notification marked as read');
});

export const markAllRead = asyncHandler(async (req, res) => {
  const { userId, schoolId } = (req as AuthenticatedRequest).user;
  await Notification.updateMany({ userId, schoolId, isRead: false }, { $set: { isRead: true } });
  return ApiResponse.success(res, 200, null, 'All notifications marked as read');
});
