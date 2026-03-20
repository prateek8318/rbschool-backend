"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllRead = exports.markAsRead = exports.getMyNotifications = void 0;
const shared_1 = require("@rbschool/shared");
const Notification_1 = require("../models/Notification");
exports.getMyNotifications = (0, shared_1.asyncHandler)(async (req, res) => {
    const { userId, schoolId } = req.user;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const query = { userId, schoolId };
    const [notifications, total, unreadCount] = await Promise.all([
        Notification_1.Notification.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Notification_1.Notification.countDocuments(query),
        Notification_1.Notification.countDocuments({ userId, schoolId, isRead: false }),
    ]);
    return shared_1.ApiResponse.success(res, 200, { notifications, unreadCount }, 'Notifications fetched successfully', {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
    });
});
exports.markAsRead = (0, shared_1.asyncHandler)(async (req, res) => {
    const { userId, schoolId } = req.user;
    const notification = await Notification_1.Notification.findOneAndUpdate({ _id: req.params.id, userId, schoolId }, { $set: { isRead: true } }, { new: true });
    if (!notification)
        throw new shared_1.ApiError(404, 'Notification not found');
    return shared_1.ApiResponse.success(res, 200, notification, 'Notification marked as read');
});
exports.markAllRead = (0, shared_1.asyncHandler)(async (req, res) => {
    const { userId, schoolId } = req.user;
    await Notification_1.Notification.updateMany({ userId, schoolId, isRead: false }, { $set: { isRead: true } });
    return shared_1.ApiResponse.success(res, 200, null, 'All notifications marked as read');
});
