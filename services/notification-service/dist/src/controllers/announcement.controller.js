"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAnnouncement = exports.createAnnouncement = exports.getAnnouncements = void 0;
const axios_1 = __importDefault(require("axios"));
const shared_1 = require("@rbschool/shared");
const env_1 = require("../config/env");
const publisher_1 = require("../events/publisher");
const Announcement_1 = require("../models/Announcement");
const Notification_1 = require("../models/Notification");
exports.getAnnouncements = (0, shared_1.asyncHandler)(async (req, res) => {
    const { schoolId, role } = req.user;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const query = role === 'admin'
        ? { schoolId, isActive: true }
        : { schoolId, isActive: true, targetRoles: { $in: [role, 'all'] } };
    const result = await Announcement_1.Announcement.paginate(query, { page, limit, sort: { createdAt: -1 } });
    return shared_1.ApiResponse.success(res, 200, result.docs, 'Announcements fetched successfully', {
        page: result.page,
        limit: result.limit,
        total: result.totalDocs,
        totalPages: result.totalPages,
    });
});
exports.createAnnouncement = (0, shared_1.asyncHandler)(async (req, res) => {
    const { userId, schoolId, role } = req.user;
    if (role !== 'admin')
        throw new shared_1.ApiError(403, 'Only admin can create announcements');
    const announcement = await Announcement_1.Announcement.create({
        schoolId,
        title: req.body.title,
        message: req.body.message,
        targetRoles: req.body.targetRoles,
        createdBy: userId,
    });
    const usersResponse = await axios_1.default.get(`${env_1.env.USER_SERVICE_URL}/internal/users-by-role`, {
        params: { roles: req.body.targetRoles.join(',') },
        headers: { 'x-school-id': schoolId },
    });
    const users = usersResponse.data.data;
    if (users.length) {
        await Notification_1.Notification.insertMany(users.map((user) => ({
            schoolId,
            userId: user.userId,
            title: announcement.title,
            message: announcement.message,
            type: 'in_app',
            relatedEntity: { type: 'announcement', id: announcement.id },
        })));
    }
    announcement.deliveredCount = users.length;
    await announcement.save();
    await (0, publisher_1.publishEvent)('announcement.sent', { schoolId, announcementId: announcement.id });
    return shared_1.ApiResponse.success(res, 201, { announcement, deliveredCount: users.length }, 'Announcement created successfully');
});
exports.deleteAnnouncement = (0, shared_1.asyncHandler)(async (req, res) => {
    const { schoolId, role } = req.user;
    if (role !== 'admin')
        throw new shared_1.ApiError(403, 'Only admin can delete announcements');
    const announcement = await Announcement_1.Announcement.findOneAndUpdate({ _id: req.params.id, schoolId }, { $set: { isActive: false } }, { new: true });
    if (!announcement)
        throw new shared_1.ApiError(404, 'Announcement not found');
    return shared_1.ApiResponse.success(res, 200, announcement, 'Announcement deleted successfully');
});
