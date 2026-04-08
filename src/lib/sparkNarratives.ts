import type { SparkPillarId, SparkPillarMeta } from "../data/sparkLevel1Questions";
import type { AssessmentResult, PillarScore } from "./sparkScoring";
import { getRecommendations, type Recommendation } from "./sparkRecommendations";

export interface NarrativePattern {
  id: string;
  summary: string;
  implication: string;
}

export interface DeeperAnalysisDirection {
  title: string;
  body: string;
}

export interface AssessmentNarrative {
  executiveSummary: string;
  strengthsSummary: string;
  focusAreaSummary: string;
  pillarNarratives: Record<SparkPillarId, string>;
  businessImplications: string[];
  recommendations: Recommendation[];
  deeperAnalysis: DeeperAnalysisDirection;
  patterns: NarrativePattern[];
}

interface PillarNarrativeSet {
  high: string;
  stable: string;
  low: string;
}

const pillarNarratives: Record<SparkPillarId, PillarNarrativeSet> = {
  social: {
    high: "Social conditions appear to be giving the organization a stable base of trust, belonging, and psychological safety. Teams in this range often coordinate faster because issues surface earlier and collaboration requires less repair work. Operationally, that usually supports steadier execution and more resilient day-to-day problem solving.",
    stable: "Social conditions look workable but not fully protected. Collaboration may function reasonably well overall while still relying on manager intervention, informal repair, or selective trust to keep work moving. That can influence execution speed and how early concerns are raised.",
    low: "Social conditions appear constrained. People may be experiencing weaker trust, reduced inclusion, or strained coordination, especially when work becomes more pressured or cross-functional. Operationally, that often shows up as slower handoffs, more unresolved tension, and less willingness to surface concerns early.",
  },
  purpose: {
    high: "Purpose conditions look strong. People likely understand direction, can connect their role to meaningful outcomes, and have a clearer line-of-sight between effort and business goals. That typically supports more coherent execution and better decision consistency.",
    stable: "Purpose appears present, but not fully dependable. People may understand the broader mission while still losing clarity when priorities shift, tradeoffs are unclear, or communication becomes uneven. Operationally, that can create drift even when effort remains high.",
    low: "Purpose conditions appear weak enough to create ambiguity. People may be working hard without enough clarity about priorities, meaningful outcomes, or how their role connects to the broader direction. That often influences decision quality, alignment, and sustained motivation.",
  },
  achievement: {
    high: "Achievement conditions appear supportive. Progress is more likely to feel visible, feedback is more likely to reinforce improvement, and people may have a stronger sense of capability in role. Operationally, that can support steadier performance and a stronger development culture.",
    stable: "Achievement conditions look serviceable but somewhat uneven. People may be making progress without always seeing it clearly, or feedback and recognition may depend too much on individual managers. That can limit confidence and make performance feel less repeatable than it should.",
    low: "Achievement conditions appear constrained. Progress may be hard to see, development may feel stalled, and feedback or recognition may not be reinforcing improvement consistently. Operationally, that can reduce confidence, weaken capability growth, and make performance harder to sustain.",
  },
  risk: {
    high: "Risk conditions look healthy. People likely have enough support for thoughtful experimentation, supported challenge, and raising concerns without unnecessary fear. That often strengthens innovation, adaptability, and learning from error.",
    stable: "Risk conditions appear mixed. Some challenge and experimentation may be supported, but people may still narrow their voice when stakes rise or when interpersonal cost feels uncertain. Operationally, that can limit learning speed and reduce the quality of feedback leaders receive.",
    low: "Risk conditions appear weak. Fear-based hesitation, suppressed ideas, or avoidance of challenge may be limiting how openly people speak, test, and learn. Operationally, that can slow innovation, delay problem escalation, and reduce change readiness.",
  },
  knowledge: {
    high: "Knowledge conditions appear strong. People likely have better access to information, clearer communication, and more visible learning support. That usually reduces preventable confusion and makes execution more consistent across roles and teams.",
    stable: "Knowledge conditions look usable but uneven. Information may generally move well while still depending too much on individual memory, inconsistent documentation, or uneven development support. That can create friction in onboarding, execution, and cross-team coordination.",
    low: "Knowledge conditions appear constrained. People may be working with inconsistent communication, weak documentation, or limited visibility into growth and development resources. Operationally, that often increases avoidable errors, slows onboarding, and creates dependence on a few people for critical context.",
  },
};

const strengthContribution: Record<SparkPillarId, string> = {
  social: "Strong Social conditions often support trust, faster coordination, and better day-to-day resilience.",
  purpose: "High Purpose scores typically indicate clearer direction and a stronger connection between role, goals, and meaningful outcomes.",
  achievement: "Strong Achievement conditions often support progress visibility, better feedback quality, and a healthier development culture.",
  risk: "High Risk scores suggest people may feel able to challenge, experiment, and contribute ideas without unnecessary fear.",
  knowledge: "Strong Knowledge conditions often reduce confusion, support onboarding, and make execution more consistent.",
};

const focusConcern: Record<SparkPillarId, string> = {
  social: "Lower Social conditions may be limiting trust, coordination, and the ability to raise concerns early.",
  purpose: "Lower Purpose conditions may be limiting clarity, line-of-sight, and more consistent decision-making.",
  achievement: "Lower Achievement conditions may be weakening progress visibility, development support, and confidence in performance.",
  risk: "A weaker Risk score may indicate fear-based hesitation, suppressed voice, or limited support for experimentation.",
  knowledge: "Lower Knowledge conditions may be increasing confusion, communication strain, and preventable friction.",
};

const sentenceFromList = (items: string[]) => {
  if (!items.length) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
};

const byId = (result: AssessmentResult) =>
  Object.fromEntries(result.pillarScores.map((pillar) => [pillar.id, pillar])) as Record<SparkPillarId, PillarScore>;

const detectPatterns = (result: AssessmentResult): NarrativePattern[] => {
  const scores = byId(result);
  const low = result.focusAreas.map((pillar) => pillar.id);
  const highs = result.strengths.filter((pillar) => pillar.percentage >= 85).map((pillar) => pillar.id);
  const spread =
    Math.max(...result.pillarScores.map((pillar) => pillar.percentage)) -
    Math.min(...result.pillarScores.map((pillar) => pillar.percentage));
  const patterns: NarrativePattern[] = [];

  const push = (pattern: NarrativePattern) => {
    if (!patterns.some((item) => item.id === pattern.id)) {
      patterns.push(pattern);
    }
  };

  if (low.length >= 3) {
    push({
      id: "distributed-strain",
      summary: "Multiple pillars fall below threshold, suggesting broader structural strain rather than a single isolated weakness.",
      implication: "This pattern may create drag across retention, consistency, and leadership load because several conditions are likely interacting at the same time.",
    });
  }

  if (low.length === 1) {
    push({
      id: "isolated-constraint",
      summary: "One pillar appears to be acting as the clearest constraint in an otherwise more workable pattern.",
      implication: "This usually points to a condition that deserves targeted review before stronger areas are forced to keep compensating for it.",
    });
  }

  if (low.includes("purpose") && low.includes("knowledge")) {
    push({
      id: "ambiguity-pattern",
      summary: "Lower Purpose and Knowledge together suggest an ambiguity pattern.",
      implication: "Execution may be slowing because people may lack both clear direction and reliable access to the information needed to act consistently.",
    });
  }

  if (low.includes("social") && low.includes("risk")) {
    push({
      id: "silence-pattern",
      summary: "Lower Social and Risk scores suggest a silence or hesitation pattern.",
      implication: "People may be less willing to raise concerns early, challenge assumptions, or surface friction before it grows.",
    });
  }

  if (low.includes("achievement") && low.includes("purpose")) {
    push({
      id: "progress-coherence-pattern",
      summary: "Lower Achievement and Purpose together suggest weak progress coherence.",
      implication: "People may be expending effort without enough clarity or visible advancement to make progress feel reliable.",
    });
  }

  if (low.includes("risk") && low.includes("knowledge")) {
    push({
      id: "learning-constraint-pattern",
      summary: "Lower Risk and Knowledge together suggest a learning constraint pattern.",
      implication: "The organization may lack both the safety to test ideas and the information flow needed to turn learning into consistent practice.",
    });
  }

  if (highs.includes("achievement") && low.includes("social")) {
    push({
      id: "performance-without-support",
      summary: "High Achievement with lower Social conditions suggests performance may be carrying more weight than support systems.",
      implication: "People may still be delivering, but hidden coordination cost or relational strain may be making that delivery harder to sustain.",
    });
  }

  if (highs.includes("purpose") && low.includes("achievement")) {
    push({
      id: "belief-without-growth",
      summary: "High Purpose with lower Achievement suggests belief in the mission may be outpacing growth infrastructure.",
      implication: "People may understand and value the direction, but lack enough feedback, recognition, or capability support to translate that into repeatable progress.",
    });
  }

  if (highs.includes("knowledge") && low.includes("risk")) {
    push({
      id: "capability-without-experimentation",
      summary: "High Knowledge with lower Risk suggests the organization may be capable but cautious.",
      implication: "People may have information and competence, while still hesitating to challenge assumptions or experiment under pressure.",
    });
  }

  if (
    result.engagementBand === "Strong but Uneven" &&
    low.length === 1 &&
    result.strengths[0]?.percentage >= 85
  ) {
    push({
      id: "one-constraint-pattern",
      summary: "The overall pattern looks solid, but one weaker condition may be limiting consistency across the system.",
      implication: "This kind of unevenness often creates avoidable compensation work because stronger pillars are carrying more than they should.",
    });
  }

  if (
    (result.engagementBand === "Vulnerable" || result.engagementBand === "At Risk") &&
    result.strengths.every((pillar) => pillar.percentage < 75)
  ) {
    push({
      id: "weak-without-strengths",
      summary: "The lower overall pattern does not show many clear stabilizing strengths.",
      implication: "That usually points to broader system strain rather than a single isolated issue, and it may require a wider structural review.",
    });
  }

  if (
    spread <= 12 &&
    result.sparkIndex >= 60 &&
    result.sparkIndex < 80 &&
    low.length <= 1
  ) {
    push({
      id: "flat-middling-pattern",
      summary: "Scores are relatively flat but middling, which can make friction feel normal rather than urgent.",
      implication: "This pattern may not create one obvious pain point, but it can still limit pace, adaptability, and the organization’s ability to improve cleanly.",
    });
  }

  return patterns;
};

const buildExecutiveSummary = (result: AssessmentResult, patterns: NarrativePattern[]) => {
  const focusCount = result.focusAreas.length;
  const focusClause =
    focusCount === 0
      ? "No pillar currently falls below the primary focus threshold, though the pattern still shows some variation across the system."
      : focusCount === 1
        ? "The pattern suggests one clearer structural constraint rather than a fully distributed breakdown."
        : focusCount === 2
          ? "The pattern appears uneven rather than uniformly weak, with two conditions standing out as attention areas."
          : "The score pattern suggests broader structural strain rather than a single isolated weakness.";

  const patternSentence = patterns[0]?.summary ?? "";
  const strengthsText = sentenceFromList(result.strengths.map((pillar) => pillar.title));

  return [
    result.engagementBand === "Thriving"
      ? "These results suggest a generally supportive foundation across the workforce system."
      : result.engagementBand === "Strong but Uneven"
        ? "These results suggest a reasonably stable foundation, but with uneven conditions that may create friction in day-to-day performance."
        : result.engagementBand === "Vulnerable"
          ? "These results suggest meaningful structural friction is likely affecting steadiness, adaptability, or retention."
          : "These results suggest at-risk conditions across the workforce system, with broader strain likely influencing more than one part of the organization.",
    focusClause,
    `The strongest current support appears in ${strengthsText}, which may be helping the organization maintain stability even where other conditions are less consistent.`,
    patternSentence,
  ]
    .filter(Boolean)
    .join(" ");
};

const buildStrengthsSummary = (result: AssessmentResult) => {
  const topTwo = result.strengths.slice(0, 2);

  if (!topTwo.length || topTwo[0].percentage < 70) {
    return "No clear strengths emerged strongly enough to anchor the narrative. That usually suggests the need to examine the system more broadly rather than assuming one healthy condition will compensate for the rest.";
  }

  const lead = `The strongest current conditions are ${sentenceFromList(topTwo.map((pillar) => pillar.title))}.`;
  const support = topTwo.map((pillar) => strengthContribution[pillar.id]).join(" ");
  const bridge = topTwo.length === 2
    ? "Together, those strengths may be helping the organization preserve more stability, clarity, or resilience than the lower-scoring areas would otherwise allow."
    : "That strength may be providing an important stabilizing effect for the wider system.";

  return `${lead} ${support} ${bridge}`;
};

const buildFocusAreaSummary = (result: AssessmentResult, patterns: NarrativePattern[]) => {
  const focusAreas = result.focusAreas;

  if (!focusAreas.length) {
    return "No pillar currently sits below 70, so the result does not point to an immediate structural failure. The more useful question is which of the lower-but-still-viable conditions may become a future constraint if they are left unattended.";
  }

  const focusTitles = sentenceFromList(focusAreas.map((pillar) => pillar.title));
  const concernLines = focusAreas.slice(0, 2).map((pillar) => focusConcern[pillar.id]).join(" ");
  const intensity =
    focusAreas.length >= 3
      ? "This looks more like broader instability than a mild point of friction."
      : focusAreas.length === 2
        ? "This looks like a meaningful structural constraint rather than a minor fluctuation."
        : "This looks more like a targeted constraint than a full system failure, but it may still limit stronger conditions if left unresolved.";
  const patternSentence = patterns.find((pattern) =>
    ["ambiguity-pattern", "silence-pattern", "progress-coherence-pattern", "learning-constraint-pattern", "distributed-strain"].includes(pattern.id),
  )?.summary;

  return `Focus areas in this snapshot include ${focusTitles}. ${concernLines} ${intensity}${patternSentence ? ` ${patternSentence}` : ""}`;
};

export const getPillarInterpretation = (pillarId: SparkPillarId, percentage: number) => {
  if (percentage >= 85) {
    return pillarNarratives[pillarId].high;
  }

  if (percentage >= 70) {
    return pillarNarratives[pillarId].stable;
  }

  return pillarNarratives[pillarId].low;
};

const buildBusinessImplications = (result: AssessmentResult, patterns: NarrativePattern[]) => {
  const scores = byId(result);
  const implications: string[] = [];

  const push = (item: string) => {
    if (!implications.includes(item)) {
      implications.push(item);
    }
  };

  patterns.forEach((pattern) => {
    push(pattern.implication);
  });

  if (scores.purpose.percentage < 70) {
    push("Lower Purpose conditions may be limiting execution speed because direction, priorities, or role-to-goal connections may not be consistently clear.");
  }

  if (scores.knowledge.percentage < 70) {
    push("Lower Knowledge conditions may be increasing onboarding friction, repeated avoidable errors, and dependence on a few people for critical context.");
  }

  if (scores.social.percentage < 70) {
    push("Lower Social conditions may be contributing to coordination drag, slower issue escalation, and more leadership time spent repairing relational friction.");
  }

  if (scores.risk.percentage < 70) {
    push("Lower Risk conditions may be limiting innovation and change readiness because people may hesitate to challenge assumptions, test ideas, or learn openly from error.");
  }

  if (scores.achievement.percentage < 70) {
    push("Lower Achievement conditions may reduce performance consistency by weakening feedback quality, progress visibility, and confidence in capability growth.");
  }

  if (scores.achievement.percentage >= 85 && scores.social.percentage < 70) {
    push("Strong Achievement alongside weaker Social conditions may mean people are still producing, but with hidden coordination cost or support strain underneath the performance.");
  }

  if (scores.purpose.percentage >= 85 && scores.achievement.percentage < 70) {
    push("High Purpose with weaker Achievement may mean the organization has belief in the direction without enough feedback, recognition, or growth infrastructure to convert that into repeatable progress.");
  }

  if (scores.knowledge.percentage >= 85 && scores.risk.percentage < 70) {
    push("High Knowledge with lower Risk may indicate a capable organization that still struggles to challenge assumptions or innovate comfortably under pressure.");
  }

  if (result.engagementBand === "Vulnerable" || result.engagementBand === "At Risk") {
    push("At this overall range, weaker conditions may also create pressure on retention, leadership bandwidth, burnout exposure, and the organization’s ability to absorb change cleanly.");
  }

  return implications.slice(0, 5);
};

const buildDeeperAnalysis = (result: AssessmentResult, patterns: NarrativePattern[]): DeeperAnalysisDirection => {
  const low = result.focusAreas.map((pillar) => pillar.id);

  if (low.length >= 3 || patterns.some((pattern) => pattern.id === "distributed-strain")) {
    return {
      title: "Suggested deeper analysis: broader organizational review",
      body: "Level 1 suggests several conditions may be interacting at once. The next step should be a broader organizational review or structured friction mapping process to identify where clarity, workload, coordination, and leadership routines are generating the pattern.",
    };
  }

  if (low.includes("purpose") && low.includes("knowledge")) {
    return {
      title: "Suggested deeper analysis: communication clarity and knowledge flow review",
      body: "Level 1 suggests ambiguity may be a central issue. A deeper review should examine how direction, decision rights, documentation, and access to role-critical information are actually working across the system.",
    };
  }

  if (low.includes("social") && low.includes("risk")) {
    return {
      title: "Suggested deeper analysis: team-level systems and leadership review",
      body: "Level 1 suggests people may be hesitating to raise issues, challenge, or collaborate cleanly. A deeper review should focus on manager cadence, escalation patterns, collaboration routines, and how challenge is handled in practice.",
    };
  }

  if (low.includes("knowledge")) {
    return {
      title: "Suggested deeper analysis: knowledge flow analysis",
      body: "Level 1 suggests the organization may be carrying avoidable friction in documentation, communication, or development support. A deeper review should examine where critical information is getting stuck or staying overly person-dependent.",
    };
  }

  if (low.includes("purpose")) {
    return {
      title: "Suggested deeper analysis: role clarity and alignment review",
      body: "Level 1 suggests direction and line-of-sight may need closer examination. A deeper review should focus on how priorities, tradeoffs, and role expectations are being communicated and reinforced.",
    };
  }

  if (low.includes("achievement")) {
    return {
      title: "Suggested deeper analysis: feedback and development systems review",
      body: "Level 1 suggests progress visibility or growth support may be limiting performance confidence. A deeper review should examine feedback cadence, recognition patterns, and whether capability-building is structured clearly enough to support repeatable progress.",
    };
  }

  if (low.includes("risk")) {
    return {
      title: "Suggested deeper analysis: experimentation and challenge review",
      body: "Level 1 suggests the organization may need a closer look at how challenge, dissent, and learning from error are handled. A deeper review should focus on speaking-up conditions, leader response patterns, and whether experimentation feels supported in practice.",
    };
  }

  if (low.includes("social")) {
    return {
      title: "Suggested deeper analysis: coordination and trust review",
      body: "Level 1 suggests collaboration may be carrying unnecessary friction. A deeper review should examine trust conditions, cross-functional routines, and whether manager intervention is compensating for weaker team coordination.",
    };
  }

  return {
    title: "Suggested deeper analysis: targeted systems review",
    body: "Level 1 shows where conditions may require deeper examination, but it does not explain root causes on its own. The next step should be a targeted systems review focused on the lowest-scoring condition and the operating mechanics around it.",
  };
};

export const buildAssessmentNarrative = (
  result: AssessmentResult,
  _pillars: SparkPillarMeta[],
): AssessmentNarrative => {
  const patterns = detectPatterns(result);
  const pillarNarrativeMap = result.pillarScores.reduce(
    (accumulator, pillar) => ({
      ...accumulator,
      [pillar.id]: getPillarInterpretation(pillar.id, pillar.percentage),
    }),
    {} as Record<SparkPillarId, string>,
  );

  return {
    executiveSummary: buildExecutiveSummary(result, patterns),
    strengthsSummary: buildStrengthsSummary(result),
    focusAreaSummary: buildFocusAreaSummary(result, patterns),
    pillarNarratives: pillarNarrativeMap,
    businessImplications: buildBusinessImplications(result, patterns),
    recommendations: getRecommendations(result, patterns.map((pattern) => pattern.id)),
    deeperAnalysis: buildDeeperAnalysis(result, patterns),
    patterns,
  };
};
