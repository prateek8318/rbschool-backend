"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = exports.initializeFirebase = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const env_1 = require("./env");
let initialized = false;
const initializeFirebase = () => {
    if (initialized ||
        !env_1.env.FIREBASE_PROJECT_ID ||
        !env_1.env.FIREBASE_CLIENT_EMAIL ||
        !env_1.env.FIREBASE_PRIVATE_KEY) {
        return;
    }
    firebase_admin_1.default.initializeApp({
        credential: firebase_admin_1.default.credential.cert({
            projectId: env_1.env.FIREBASE_PROJECT_ID,
            clientEmail: env_1.env.FIREBASE_CLIENT_EMAIL,
            privateKey: env_1.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
    });
    initialized = true;
};
exports.initializeFirebase = initializeFirebase;
const sendPushNotification = async (token, title, body) => {
    if (env_1.env.NODE_ENV !== "production" || !initialized) {
        console.log(`Push notification -> ${token}: ${title} | ${body}`);
        return;
    }
    await firebase_admin_1.default.messaging().send({
        token,
        notification: { title, body },
    });
};
exports.sendPushNotification = sendPushNotification;
