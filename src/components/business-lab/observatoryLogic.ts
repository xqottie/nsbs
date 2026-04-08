export const PILLAR_ORDER = [
  "Social",
  "Purpose",
  "Achievement",
  "Risk",
  "Knowledge",
] as const;

export type PillarName = (typeof PILLAR_ORDER)[number];
export type ScoreScale = "0to100" | "0to5";

export interface ObservatoryMetric {
  id: string;
  pillar: PillarName;
  label: string;
  value: string;
  unit?: string;
  status: string;
  timeframe: string;
  sourceLabel: string;
  sourceUrl?: string;
  trendLabel?: string;
}

export interface ObservatoryPillar {
  key: PillarName;
  title: string;
  score: number;
  band: string;
  tone: string;
  signalSummary: string;
  metrics: ObservatoryMetric[];
  employerImplications: string[];
  recommendedActions: string[];
  sourceChips: string[];
  sourceUpdatedLabel?: string;
}

export interface ObservatorySignal {
  id: string;
  dateLabel: string;
  pillar: PillarName;
  title: string;
  summary: string;
  sourceLabel: string;
  sourceUrl?: string;
}

export interface ObservatorySource {
  label: string;
  url?: string;
}

export interface ObservatoryModel {
  updatedLabel: string;
  generatedAt: string;
  sourceCluster: ObservatorySource[];
  confidence: string;
  sourceDelayNote: string | null;
  composite: {
    score: number;
    band: string;
    tone: string;
    summary: string;
  };
  orderedPillars: PillarName[];
  pillars: Record<PillarName, ObservatoryPillar>;
  countyRepresentatives?: unknown;
  counties?: unknown;
  signals: ObservatorySignal[];
  methodology?: unknown;
  sources?: ObservatorySource[];
}

export const RADAR_CENTER = {
  x: 180,
  y: 180,
  radius: 130,
};

export const RADAR_ANGLES = [-90, -18, 54, 126, 198].map(
  (angle) => (angle * Math.PI) / 180,
);

const SEGMENT_SPAN = (72 * Math.PI) / 180;
const wholeNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function clampScore(value: number, scale: ScoreScale = "0to100") {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = scale === "0to5" ? (value / 5) * 100 : value;
  return Math.max(0, Math.min(100, normalized));
}

export function formatWholeNumber(value: number | null | undefined) {
  return Number.isFinite(value ?? NaN)
    ? wholeNumberFormatter.format(Math.round(Number(value)))
    : "N/A";
}

export function getRiskBand(value: number, scale: ScoreScale = "0to100") {
  const normalized = clampScore(value, scale);

  if (normalized >= 70) {
    return {
      band: "low",
      label: "Lower Risk",
      color: "green",
    } as const;
  }

  if (normalized >= 45) {
    return {
      band: "moderate",
      label: "Moderate Risk",
      color: "yellow",
    } as const;
  }

  return {
    band: "high",
    label: "Higher Risk",
    color: "red",
  } as const;
}

export function pillarKey(pillar: PillarName) {
  return pillar.toLowerCase();
}

export function polarPoint(angle: number, radius: number) {
  return {
    x: RADAR_CENTER.x + Math.cos(angle) * radius,
    y: RADAR_CENTER.y + Math.sin(angle) * radius,
  };
}

export function axisPoint(index: number, score = 100) {
  const radius = RADAR_CENTER.radius * (clampScore(score) / 100);
  return polarPoint(RADAR_ANGLES[index], radius);
}

export function ringPolygonPoints(multiplier: number) {
  return PILLAR_ORDER.map((pillar, index) => {
    const point = axisPoint(index, multiplier * 100);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ");
}

export function polygonPoints(scores: Record<PillarName, number>) {
  return PILLAR_ORDER.map((pillar, index) => {
    const point = axisPoint(index, scores[pillar]);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ");
}

export function wedgePath(index: number, outerRadius = 178, innerRadius = 138) {
  const startOuter = polarPoint(RADAR_ANGLES[index] - SEGMENT_SPAN / 2, outerRadius);
  const endOuter = polarPoint(RADAR_ANGLES[index] + SEGMENT_SPAN / 2, outerRadius);
  const endInner = polarPoint(RADAR_ANGLES[index] + SEGMENT_SPAN / 2, innerRadius);
  const startInner = polarPoint(RADAR_ANGLES[index] - SEGMENT_SPAN / 2, innerRadius);
  const largeArc = SEGMENT_SPAN > Math.PI ? 1 : 0;

  return [
    `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)}`,
    `L ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function labelArcPath(index: number, radius = 152) {
  const padding = SEGMENT_SPAN * 0.15;
  const start = polarPoint(RADAR_ANGLES[index] - SEGMENT_SPAN / 2 + padding, radius);
  const end = polarPoint(RADAR_ANGLES[index] + SEGMENT_SPAN / 2 - padding, radius);
  const largeArc = SEGMENT_SPAN - padding * 2 > Math.PI ? 1 : 0;

  return [
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  ].join(" ");
}

export function getScoreMap(model: ObservatoryModel) {
  return PILLAR_ORDER.reduce(
    (scores, pillar) => {
      scores[pillar] = clampScore(Number(model.pillars[pillar]?.score ?? 0));
      return scores;
    },
    {} as Record<PillarName, number>,
  );
}

export function escapeJsonForScript(json: string) {
  return json.replaceAll("</", "<\\/");
}
