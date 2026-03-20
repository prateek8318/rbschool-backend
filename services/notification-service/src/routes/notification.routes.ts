import { Router } from 'express';
import { body, param } from 'express-validator';
import { createAnnouncement, deleteAnnouncement, getAnnouncementStats, getAnnouncements } from '../controllers/announcement.controller';
import { getMyNotifications, markAllRead, markAsRead } from '../controllers/notification.controller';
import { requireServiceAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/error.middleware';

const router = Router();

router.get('/notifications', requireServiceAuth, getMyNotifications);
router.put('/notifications/:id/read', requireServiceAuth, [param('id').isMongoId()], validateRequest, markAsRead);
router.put('/notifications/read-all', requireServiceAuth, markAllRead);

router.get('/announcements', requireServiceAuth, getAnnouncements);
router.get('/announcements/stats', requireServiceAuth, getAnnouncementStats);
router.post('/announcements', requireServiceAuth, [body('title').isString().notEmpty(), body('message').isString().notEmpty(), body('targetRoles').isArray({ min: 1 })], validateRequest, createAnnouncement);
router.delete('/announcements/:id', requireServiceAuth, [param('id').isMongoId()], validateRequest, deleteAnnouncement);

export default router;
