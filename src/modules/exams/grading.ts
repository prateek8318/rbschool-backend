import { round } from '../../core/utils';

export interface GradeBand {
  min: number;
  grade: string;
  gradePoint?: number;
}

export const gradeFor = (percent: number, scale: GradeBand[]) => {
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  return sorted.find((band) => percent >= band.min) ?? sorted[sorted.length - 1];
};

interface Paper {
  subjectId: unknown;
  maxMarks: number;
  passMarks?: number | null;
}

interface Score {
  subjectId: unknown;
  marks?: number | null;
  isAbsent?: boolean | null;
  grade?: string | null;
}

/**
 * Totals, grade and pass/fail for one student. Every paper of the exam counts
 * towards the maximum; a paper with no marks yet makes the result "incomplete".
 */
export const computeResult = (
  papers: Paper[],
  scores: Score[],
  settings: { gradingScale: GradeBand[]; passPercentage: number },
) => {
  const scoreBySubject = new Map(scores.map((score) => [String(score.subjectId), score]));
  let totalMarks = 0;
  let maxMarks = 0;
  let complete = true;
  let failed = false;

  for (const paper of papers) {
    maxMarks += paper.maxMarks;
    const score = scoreBySubject.get(String(paper.subjectId));
    const passMarks = paper.passMarks ?? (paper.maxMarks * settings.passPercentage) / 100;

    if (!score || (!score.isAbsent && (score.marks === null || score.marks === undefined))) {
      complete = false;
      continue;
    }
    if (score.isAbsent) {
      failed = true;
      score.grade = 'AB';
      continue;
    }
    totalMarks += score.marks!;
    if (score.marks! < passMarks) failed = true;
    score.grade = gradeFor((score.marks! / paper.maxMarks) * 100, settings.gradingScale)?.grade;
  }

  const percent = maxMarks ? round((totalMarks / maxMarks) * 100) : 0;
  const band = gradeFor(percent, settings.gradingScale);
  return {
    totalMarks: round(totalMarks),
    maxMarks,
    percentage: percent,
    grade: complete ? band?.grade : undefined,
    gradePoint: complete ? band?.gradePoint : undefined,
    result: (!complete ? 'incomplete' : failed ? 'fail' : 'pass') as 'pass' | 'fail' | 'incomplete',
  };
};

/** Standard competition ranking: equal totals share a rank (1, 2, 2, 4). */
export const assignRanks = <T extends { totalMarks: number }>(rows: T[]) => {
  const sorted = [...rows].sort((a, b) => b.totalMarks - a.totalMarks);
  return sorted.map((row, index) => {
    const rank = index > 0 && sorted[index - 1].totalMarks === row.totalMarks ? undefined : index + 1;
    return { row, rank };
  }).reduce<Array<{ row: T; rank: number }>>((acc, item) => {
    acc.push({ row: item.row, rank: item.rank ?? acc[acc.length - 1].rank });
    return acc;
  }, []);
};
