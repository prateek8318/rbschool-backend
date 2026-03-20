import axios from 'axios';
import { ApiError, ApiResponse, asyncHandler } from '@rbschool/shared';
import { env } from '../config/env';
import { publishEvent } from '../events/publisher';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Announcement } from '../models/Announcement';
import { Notification } from '../models/Notification';

export const getAnnouncements = asyncHandler(async (req, res) => {
  const { schoolId, role } = (req as AuthenticatedRequest).user;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 10);
  const query =
    role === 'admin'
      ? { schoolId, isActive: true }
      : { schoolId, isActive: true, targetRoles: { $in: [role, 'all'] } };
  const [announcements, total] = await Promise.all([
    Announcement.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Announcement.countDocuments(query),
  ]);
  return ApiResponse.success(res, 200, announcements, 'Announcements fetched successfully', {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

export const createAnnouncement = asyncHandler(async (req, res) => {
  const { userId, schoolId, role } = (req as AuthenticatedRequest).user;
  if (role !== 'admin') throw new ApiError(403, 'Only admin can create announcements');

  const announcement = await Announcement.create({
    schoolId,
    title: req.body.title,
    message: req.body.message,
    targetRoles: req.body.targetRoles,
    createdBy: userId,
  });

  const usersResponse = await axios.get(`${env.USER_SERVICE_URL}/internal/users-by-role`, {
    params: { roles: req.body.targetRoles.join(',') },
    headers: { 'x-school-id': schoolId },
  });
  const users = usersResponse.data.data as Array<{ userId: string }>;
  if (users.length) {
    await Notification.insertMany(
      users.map((user) => ({
        schoolId,
        userId: user.userId,
        title: announcement.title,
        message: announcement.message,
        type: 'in_app',
        relatedEntity: { type: 'announcement', id: announcement.id },
      })),
    );
  }
  announcement.deliveredCount = users.length;
  await announcement.save();
  await publishEvent('announcement.sent', { schoolId, announcementId: announcement.id });
  return ApiResponse.success(res, 201, { announcement, deliveredCount: users.length }, 'Announcement created successfully');
});

export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const { schoolId, role } = (req as AuthenticatedRequest).user;
  if (role !== 'admin') throw new ApiError(403, 'Only admin can delete announcements');
  const announcement = await Announcement.findOneAndUpdate({ _id: req.params.id, schoolId }, { $set: { isActive: false } }, { new: true });
  if (!announcement) throw new ApiError(404, 'Announcement not found');
  return ApiResponse.success(res, 200, announcement, 'Announcement deleted successfully');
});

export const getAnnouncementStats = asyncHandler(async (req, res) => {
  const { schoolId, role } = (req as AuthenticatedRequest).user;
  if (role !== 'admin') throw new ApiError(403, 'Only admin can view announcement stats');

  const announcements = await Announcement.find({ schoolId, isActive: true });
  const announcementIds = announcements.map((announcement) => announcement.id);
  const notifications = announcementIds.length
    ? await Notification.find({
        schoolId,
        'relatedEntity.type': 'announcement',
        'relatedEntity.id': { $in: announcementIds },
      })
    : [];

  const total = announcements.length;
  const delivered = announcements.reduce((sum, announcement) => sum + announcement.deliveredCount, 0);
  const read = notifications.filter((notification) => notification.isRead).length;
  const readRate = delivered > 0 ? Number(((read / delivered) * 100).toFixed(2)) : 0;

  return ApiResponse.success(res, 200, { total, delivered, readRate }, 'Announcement stats fetched successfully');
});
