import { Types } from 'mongoose';
import { DeviceToken, Notification, NOTIFICATION_CATEGORIES } from './communication.models';

type Category = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotifyInput {
  institutionId: string;
  userIds: Array<string | Types.ObjectId>;
  title: string;
  body: string;
  category: Category;
  data?: Record<string, unknown>;
}

/**
 * Push delivery is a stub until the mobile apps exist. Plug in FCM / Expo
 * push here; everything else (inbox, events) already works.
 */
const sendPush = async (userIds: string[], title: string, body: string) => {
  const tokens = await DeviceToken.countDocuments({ userId: { $in: userIds } });
  if (tokens) console.log(`[push] would send "${title}" to ${tokens} device(s): ${body}`);
};

/** Writes inbox notifications (one per unique user) and triggers push. */
export const notify = async (input: NotifyInput) => {
  const userIds = [...new Set(input.userIds.map(String))];
  if (!userIds.length) return;
  await Notification.insertMany(
    userIds.map((userId) => ({
      institutionId: input.institutionId,
      userId,
      title: input.title,
      body: input.body,
      category: input.category,
      data: input.data,
    })),
  );
  await sendPush(userIds, input.title, input.body);
};
