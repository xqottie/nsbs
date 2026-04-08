import type { SparkPillarId } from "../data/sparkLevel1Questions";
import type { AssessmentResult, PillarScore } from "./sparkScoring";

export interface Recommendation {
  title: string;
  body: string;
}

const recommendationLibrary: Record<SparkPillarId, Recommendation> = {
  social: {
    title: "Strengthen trust and coordination conditions",
    body: "Examine whether manager cadence, cross-functional routines, and team interaction patterns are making collaboration more fragile than it appears. The goal is not generic connection work. It is more reliable coordination, trust, and psychological safety.",
  },
  purpose: {
    title: "Clarify direction, role contribution, and tradeoffs",
    body: "Tighten the line between organizational priorities, team goals, and role expectations. Reduce ambiguity around what matters most so effort does not drift under pressure.",
  },
  achievement: {
    title: "Make progress, feedback, and recognition easier to see",
    body: "Improve how feedback loops, recognition patterns, and skill-growth pathways are designed. Progress should not depend on guesswork or inconsistent reinforcement.",
  },
  risk: {
    title: "Support thoughtful experimentation and challenge",
    body: "Increase the conditions for speaking up, testing ideas, and learning from mistakes without fear-based hesitation. Strong systems do not remove challenge. They make better challenge safer to carry.",
  },
  knowledge: {
    title: "Reduce preventable friction in information flow",
    body: "Strengthen documentation clarity, information access, and development support so people can work with less confusion and fewer repeated errors.",
  },
};

const patternRecommendations: Record<string, Recommendation> = {
  "ambiguity-pattern": {
    title: "Clarify decision rights and information pathways",
    body: "Review how priorities, tradeoffs, decision rights, and documentation are carried through the organization. The goal is to reduce ambiguity at the source rather than asking teams to compensate for it.",
  },
  "silence-pattern": {
    title: "Examine whether challenge and escalation feel safe in practice",
    body: "Review manager response patterns, team routines, and escalation pathways to see whether people feel able to speak, challenge, and surface issues early without unnecessary interpersonal cost.",
  },
  "progress-coherence-pattern": {
    title: "Reconnect progress systems to strategic direction",
    body: "Tighten the link between priorities, performance signals, feedback, and visible progress so effort is more clearly translating into advancement and useful outcomes.",
  },
  "learning-constraint-pattern": {
    title: "Strengthen the system for learning under uncertainty",
    body: "Review whether documentation, communication, and experimentation conditions are strong enough to support learning from error and adaptation in real time.",
  },
  "distributed-strain": {
    title: "Run a broader structural review before choosing isolated fixes",
    body: "When several pillars are weak at once, the more useful next step is to map where the same root conditions are showing up across the system rather than solving each symptom separately.",
  },
  "performance-without-support": {
    title: "Protect delivery capacity while repairing coordination strain",
    body: "Review whether strong individual effort is compensating for weaker trust, collaboration, or support conditions. The goal is to remove hidden coordination cost before it erodes performance.",
  },
  "belief-without-growth": {
    title: "Convert mission alignment into development infrastructure",
    body: "If people believe in the direction but lack visible growth support, review feedback cadence, recognition consistency, and capability-building pathways.",
  },
  "capability-without-experimentation": {
    title: "Create safer pathways for testing and dissent",
    body: "If people have capability but hesitate to challenge or experiment, strengthen the conditions for thoughtful risk-taking and learning-oriented responses to mistakes.",
  },
};

const fallbackRecommendations: Recommendation[] = [
  {
    title: "Validate the pattern through deeper diagnostics",
    body: "Use the Level 1 result as a starting point for structured analysis rather than a final answer. The next layer should examine where operating design, manager load, and system rules are generating the pattern.",
  },
  {
    title: "Translate results into structural priorities",
    body: "Choose one or two system-level changes that would improve clarity, coordination, or support capacity. Focus on operating conditions before broad culture messaging.",
  },
  {
    title: "Protect strengths while correcting weaker conditions",
    body: "High-scoring pillars should be treated as assets to protect, not reasons to stop examining the system. Strong conditions can weaken quickly when one weak area keeps creating drag.",
  },
];

const uniqueByTitle = (items: Recommendation[]) =>
  items.filter((item, index, list) => list.findIndex((candidate) => candidate.title === item.title) === index);

export const getRecommendations = (result: AssessmentResult, patternIds: string[] = []): Recommendation[] => {
  const focusPillars = result.focusAreas.length
    ? result.focusAreas
    : [...result.pillarScores].sort((left, right) => left.percentage - right.percentage).slice(0, 2);

  const recommendations = focusPillars.map((pillar: PillarScore) => recommendationLibrary[pillar.id]);
  const patternItems = patternIds
    .map((patternId) => patternRecommendations[patternId])
    .filter((item): item is Recommendation => Boolean(item));
  const merged = uniqueByTitle([...recommendations, ...patternItems, ...fallbackRecommendations]);

  return merged.slice(0, Math.min(5, Math.max(3, recommendations.length + 1)));
};
