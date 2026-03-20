export const getGrade = (marks: number, maxMarks: number): string => {
  const percentage = (marks / maxMarks) * 100;
  if (percentage >= 95) return 'A+';
  if (percentage >= 85) return 'A';
  if (percentage >= 75) return 'B+';
  if (percentage >= 65) return 'B';
  if (percentage >= 50) return 'C';
  return 'F';
};

export const calculateRanks = (
  marksArray: Array<{ studentId: string; total: number }>,
): Array<{ studentId: string; rank: number; total: number }> => {
  const sorted = [...marksArray].sort((a, b) => b.total - a.total);
  return sorted.map((item, index) => ({ ...item, rank: index + 1 }));
};
