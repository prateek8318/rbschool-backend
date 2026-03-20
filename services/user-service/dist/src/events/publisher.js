"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishEvent = void 0;
const redis_1 = require("../config/redis");
const publishEvent = async (channel, payload) => {
    await redis_1.redisClient.publish(channel, JSON.stringify(payload));
};
exports.publishEvent = publishEvent;
