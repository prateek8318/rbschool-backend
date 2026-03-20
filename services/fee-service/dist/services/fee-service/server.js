"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const db_1 = require("./src/config/db");
const env_1 = require("./src/config/env");
const subscriber_1 = require("./src/events/subscriber");
const overdueChecker_1 = require("./src/jobs/overdueChecker");
const start = async () => {
    await (0, db_1.connectDB)();
    await (0, subscriber_1.initializeSubscribers)();
    (0, overdueChecker_1.startOverdueChecker)();
    app_1.default.listen(env_1.env.PORT, () => {
        console.log(`RBSchool fee-service running on port ${env_1.env.PORT}`);
    });
};
start().catch((error) => {
    console.error('Failed to start fee-service', error);
    process.exit(1);
});
