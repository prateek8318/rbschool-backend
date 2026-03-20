"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRanks = exports.getGrade = void 0;
const getGrade = (marks, maxMarks) => {
    const percentage = (marks / maxMarks) * 100;
    if (percentage >= 95)
        return 'A+';
    if (percentage >= 85)
        return 'A';
    if (percentage >= 75)
        return 'B+';
    if (percentage >= 65)
        return 'B';
    if (percentage >= 50)
        return 'C';
    return 'F';
};
exports.getGrade = getGrade;
const calculateRanks = (marksArray) => {
    const sorted = [...marksArray].sort((a, b) => b.total - a.total);
    return sorted.map((item, index) => ({ ...item, rank: index + 1 }));
};
exports.calculateRanks = calculateRanks;
