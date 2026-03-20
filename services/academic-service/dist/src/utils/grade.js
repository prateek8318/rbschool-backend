"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateGrade = void 0;
const calculateGrade = (percentage) => {
    if (percentage >= 95) {
        return "A+";
    }
    if (percentage >= 85) {
        return "A";
    }
    if (percentage >= 75) {
        return "B+";
    }
    if (percentage >= 65) {
        return "B";
    }
    if (percentage >= 50) {
        return "C";
    }
    return "F";
};
exports.calculateGrade = calculateGrade;
