"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSubscribers = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../config/env");
const Marks_1 = require("../models/Marks");
const initializeSubscribers = async () => {
    const subscriber = new ioredis_1.default(env_1.env.REDIS_URL);
    await subscriber.subscribe('student.deleted');
    subscriber.on('message', async (channel, message) => {
        if (channel !== 'student.deleted') {
            return;
        }
        const payload = JSON.parse(message);
        await Marks_1.Marks.deleteMany({ studentId: payload.studentId });
    });
};
exports.initializeSubscribers = initializeSubscribers;
