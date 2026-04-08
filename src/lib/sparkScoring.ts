import type { SparkLevel1Question, SparkPillarId, SparkPillarMeta } from "../data/sparkLevel1Questions";

export type AssessmentAnswers = Record<string, number>;

export interface PillarScore {
  id: SparkPillarId;
  title: string;
  average: number;
  percentage: number;
  answered: number;
  questionIds: string[];
  status: "Leading" | "Stable" | "Watch" | "Priority";
}

export interface AssessmentResult {
  answeredCount: number;
  sparkIndex: number;
  engagementBand: "Thriving" | "Strong but Uneven" | "Vulnerable" | "At Risk";
  pillarScores: PillarScore[];
  strengths: PillarScore[];
  focusAreas: PillarScore[];
  isComplete: boolean;
}

const clampLikert = (value: number | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }

  return Math.min(5, Math.max(1, value));
};

const roundToSingleDecimal = (value: number) => Math.round(value * 10) / 10;

export const toDisplayPercentage = (value: number) => Math.round(value);

export const getEngagementBand = (sparkIndex: number): AssessmentResult["engagementBand"] => {
  if (sparkIndex >= 85) {
    return "Thriving";
  }

  if (sparkIndex >= 70) {
    return "Strong but Uneven";
  }

  if (sparkIndex >= 55) {
    return "Vulnerable";
  }

  return "At Risk";
};

export const getPillarStatus = (percentage: number): PillarScore["status"] => {
  if (percentage >= 85) {
    return "Leading";
  }

  if (percentage >= 70) {
    return "Stable";
  }

  if (percentage >= 55) {
    return "Watch";
  }

  return "Priority";
};

export const getAnsweredCount = (
  answers: AssessmentAnswers,
  questions: SparkLevel1Question[],
) => questions.filter((question) => clampLikert(answers[question.id]) !== undefined).length;

export const getMissingQuestionIds = (
  answers: AssessmentAnswers,
  questions: SparkLevel1Question[],
) =>
  questions
    .filter((question) => clampLikert(answers[question.id]) === undefined)
    .map((question) => question.id);

export const scoreAssessment = (
  answers: AssessmentAnswers,
  questions: SparkLevel1Question[],
  pillars: SparkPillarMeta[],
): AssessmentResult => {
  const answeredCount = getAnsweredCount(answers, questions);
  const isComplete = answeredCount === questions.length;

  const pillarScores = pillars.map((pillar) => {
    const pillarQuestions = questions.filter((question) => question.pillar === pillar.id);
    const values = pillarQuestions
      .map((question) => clampLikert(answers[question.id]))
      .filter((value): value is number => value !== undefined);
    const total = values.reduce((sum, value) => sum + value, 0);
    const average = values.length ? roundToSingleDecimal(total / values.length) : 0;
    const percentage = values.length ? roundToSingleDecimal((average / 5) * 100) : 0;

    return {
      id: pillar.id,
      title: pillar.title,
      average,
      percentage,
      answered: values.length,
      questionIds: pillarQuestions.map((question) => question.id),
      status: getPillarStatus(percentage),
    };
  });

  const totalResponseValue = pillarScores.reduce(
    (sum, pillar) => sum + pillar.average * pillar.answered,
    0,
  );
  const sparkIndex = answeredCount ? roundToSingleDecimal((totalResponseValue / answeredCount / 5) * 100) : 0;
  const sorted = [...pillarScores].sort((left, right) => right.percentage - left.percentage);
  const strengths = sorted.slice(0, 2);
  const focusAreas = [...pillarScores]
    .filter((pillar) => pillar.percentage < 70)
    .sort((left, right) => left.percentage - right.percentage);

  return {
    answeredCount,
    sparkIndex,
    engagementBand: getEngagementBand(sparkIndex),
    pillarScores,
    strengths,
    focusAreas,
    isComplete,
  };
};
