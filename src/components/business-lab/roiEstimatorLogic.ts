export const ROI_SCENARIOS = {
  conservative: {
    key: "conservative",
    label: "Conservative",
    turnoverReductionMultiplier: 0.45,
    productivityGainMultiplier: 0.35,
    absenteeReductionMultiplier: 0.55,
    disengagementRecoveryMultiplier: 0.2,
    turnoverReductionCap: 0.12,
    productivityGainCap: 0.08,
    absenteeReductionCap: 0.18,
    disengagementRecoveryCap: 0.05,
  },
  typical: {
    key: "typical",
    label: "Typical",
    turnoverReductionMultiplier: 0.6,
    productivityGainMultiplier: 0.5,
    absenteeReductionMultiplier: 0.8,
    disengagementRecoveryMultiplier: 0.3,
    turnoverReductionCap: 0.2,
    productivityGainCap: 0.12,
    absenteeReductionCap: 0.25,
    disengagementRecoveryCap: 0.08,
  },
  aggressive: {
    key: "aggressive",
    label: "Aggressive",
    turnoverReductionMultiplier: 0.75,
    productivityGainMultiplier: 0.65,
    absenteeReductionMultiplier: 1,
    disengagementRecoveryMultiplier: 0.4,
    turnoverReductionCap: 0.28,
    productivityGainCap: 0.16,
    absenteeReductionCap: 0.35,
    disengagementRecoveryCap: 0.1,
  },
} as const;

export const ROI_SCENARIO_ORDER = [
  "conservative",
  "typical",
  "aggressive",
] as const;

export type RoiScenarioKey = (typeof ROI_SCENARIO_ORDER)[number];
export type RoiScenario = (typeof ROI_SCENARIOS)[RoiScenarioKey];

export const ROI_DEFAULTS = {
  workforceSize: 100,
  averageSalary: 60000,
  turnoverRate: 20,
  replacementCostRate: 40,
  absenteeDaysPerEmployee: 6,
  workdaysPerYear: 260,
  engagementImprovement: 10,
  scenario: "typical",
  absenteeCostMultiplier: 1,
  impactCapAdjustment: 100,
  realtimeUpdates: true,
} as const;

export interface RoiInputValues {
  workforceSize?: number | string;
  averageSalary?: number | string;
  turnoverRate?: number | string;
  replacementCostRate?: number | string;
  absenteeDaysPerEmployee?: number | string;
  workdaysPerYear?: number | string;
  engagementImprovement?: number | string;
  scenario?: RoiScenarioKey | string | null;
  programCost?: number | string | null;
  absenteeCostMultiplier?: number | string;
  impactCapAdjustment?: number | string;
  realtimeUpdates?: boolean | null;
}

export interface SanitizedRoiInputs {
  workforceSize: number;
  averageSalary: number;
  turnoverRate: number;
  replacementCostRate: number;
  absenteeDaysPerEmployee: number;
  workdaysPerYear: number;
  engagementImprovement: number;
  scenario: RoiScenarioKey;
  programCost: number | null;
  absenteeCostMultiplier: number;
  impactCapAdjustment: number;
  realtimeUpdates: boolean;
}

export interface RoiCalculationResult {
  inputs: SanitizedRoiInputs;
  scenario: RoiScenario;
  derived: {
    payroll: number;
    leavers: number;
    replacementCost: number;
    turnoverCost: number;
    dailyWage: number;
    absenteeCost: number;
  };
  rates: {
    turnoverReductionRate: number;
    productivityGainRate: number;
    absenteeReductionRate: number;
    recoveredDragRate: number;
  };
  components: {
    turnoverSavings: number;
    productivityValue: number;
    absenteeSavings: number;
    disengagementSavings: number;
  };
  totals: {
    totalValue: number;
    valuePerEmployee: number;
    roiMultiple: number | null;
    paybackMonths: number | null;
  };
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function numericValue(value: number | string | undefined, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function nullableValue(value: number | string | null | undefined) {
  if (value == null || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeScenario(value: string | RoiScenarioKey | null | undefined): RoiScenarioKey {
  return value === "conservative" || value === "typical" || value === "aggressive"
    ? value
    : ROI_DEFAULTS.scenario;
}

export function sanitizeRoiInputs(values: RoiInputValues = {}): SanitizedRoiInputs {
  const workforceSize = Math.round(
    clampValue(numericValue(values.workforceSize, ROI_DEFAULTS.workforceSize), 1, 1000000),
  );
  const averageSalary = Math.round(
    clampValue(numericValue(values.averageSalary, ROI_DEFAULTS.averageSalary), 10000, 5000000),
  );
  const turnoverRate = clampValue(
    numericValue(values.turnoverRate, ROI_DEFAULTS.turnoverRate),
    0,
    100,
  );
  const replacementCostRate = clampValue(
    numericValue(values.replacementCostRate, ROI_DEFAULTS.replacementCostRate),
    20,
    100,
  );
  const absenteeDaysPerEmployee = clampValue(
    numericValue(values.absenteeDaysPerEmployee, ROI_DEFAULTS.absenteeDaysPerEmployee),
    0,
    60,
  );
  const workdaysPerYear = Math.round(
    clampValue(numericValue(values.workdaysPerYear, ROI_DEFAULTS.workdaysPerYear), 200, 365),
  );
  const engagementImprovement = clampValue(
    numericValue(values.engagementImprovement, ROI_DEFAULTS.engagementImprovement),
    0,
    20,
  );
  const rawProgramCost = nullableValue(values.programCost);
  const programCost =
    rawProgramCost !== null && rawProgramCost > 0
      ? clampValue(rawProgramCost, 1, 100000000)
      : null;
  const absenteeCostMultiplier = clampValue(
    numericValue(values.absenteeCostMultiplier, ROI_DEFAULTS.absenteeCostMultiplier),
    0.25,
    3,
  );
  const impactCapAdjustment = clampValue(
    numericValue(values.impactCapAdjustment, ROI_DEFAULTS.impactCapAdjustment),
    50,
    200,
  );

  return {
    workforceSize,
    averageSalary,
    turnoverRate,
    replacementCostRate,
    absenteeDaysPerEmployee,
    workdaysPerYear,
    engagementImprovement,
    scenario: normalizeScenario(values.scenario),
    programCost,
    absenteeCostMultiplier,
    impactCapAdjustment,
    realtimeUpdates: Boolean(values.realtimeUpdates ?? ROI_DEFAULTS.realtimeUpdates),
  };
}

export function calculateRoi(values: RoiInputValues = {}): RoiCalculationResult {
  const inputs = sanitizeRoiInputs(values);
  const scenario = ROI_SCENARIOS[inputs.scenario];
  const workforceSize = inputs.workforceSize;
  const averageSalary = inputs.averageSalary;
  const turnoverRate = inputs.turnoverRate / 100;
  const replacementCostRate = inputs.replacementCostRate / 100;
  const absenteeDays = inputs.absenteeDaysPerEmployee;
  const workdays = inputs.workdaysPerYear;
  const engagementImprovement = inputs.engagementImprovement / 100;
  const programCost = inputs.programCost ?? 0;
  const impactCapAdjustment = inputs.impactCapAdjustment / 100;

  const payroll = workforceSize * averageSalary;
  const leavers = workforceSize * turnoverRate;
  const replacementCost = averageSalary * replacementCostRate;
  const turnoverCost = leavers * replacementCost;
  const dailyWage = averageSalary / workdays;
  const absenteeCost = workforceSize * absenteeDays * dailyWage * inputs.absenteeCostMultiplier;

  const turnoverReductionRate = Math.min(
    scenario.turnoverReductionCap * impactCapAdjustment,
    engagementImprovement * scenario.turnoverReductionMultiplier,
  );
  const productivityGainRate = Math.min(
    scenario.productivityGainCap * impactCapAdjustment,
    engagementImprovement * scenario.productivityGainMultiplier,
  );
  const absenteeReductionRate = Math.min(
    scenario.absenteeReductionCap * impactCapAdjustment,
    engagementImprovement * scenario.absenteeReductionMultiplier,
  );
  const recoveredDragRate = Math.min(
    scenario.disengagementRecoveryCap * impactCapAdjustment,
    engagementImprovement * scenario.disengagementRecoveryMultiplier,
  );

  const turnoverSavings = turnoverCost * turnoverReductionRate;
  const productivityValue = payroll * productivityGainRate;
  const absenteeSavings = absenteeCost * absenteeReductionRate;
  const disengagementSavings = payroll * recoveredDragRate;
  const totalValue =
    turnoverSavings + productivityValue + absenteeSavings + disengagementSavings;
  const valuePerEmployee = totalValue / workforceSize;
  const roiMultiple = programCost > 0 ? totalValue / programCost : null;
  const paybackMonths = programCost > 0 && totalValue > 0 ? (programCost / totalValue) * 12 : null;

  return {
    inputs,
    scenario,
    derived: {
      payroll,
      leavers,
      replacementCost,
      turnoverCost,
      dailyWage,
      absenteeCost,
    },
    rates: {
      turnoverReductionRate,
      productivityGainRate,
      absenteeReductionRate,
      recoveredDragRate,
    },
    components: {
      turnoverSavings,
      productivityValue,
      absenteeSavings,
      disengagementSavings,
    },
    totals: {
      totalValue,
      valuePerEmployee,
      roiMultiple,
      paybackMonths,
    },
  };
}

export function compareRoiScenarios(values: RoiInputValues = {}) {
  const inputs = sanitizeRoiInputs(values);

  return ROI_SCENARIO_ORDER.reduce(
    (result, scenario) => {
      result[scenario] = calculateRoi({
        ...inputs,
        scenario,
      });
      return result;
    },
    {} as Record<RoiScenarioKey, RoiCalculationResult>,
  );
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const oneDecimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number | null | undefined) {
  return currencyFormatter.format(Number.isFinite(value ?? NaN) ? Number(value) : 0);
}

export function formatCompactCurrency(value: number | null | undefined) {
  return compactCurrencyFormatter.format(Number.isFinite(value ?? NaN) ? Number(value) : 0);
}

export function formatPercent(value: number | null | undefined, precision = 0) {
  if (!Number.isFinite(value ?? NaN)) {
    return "0%";
  }

  const numeric = Number(value);
  return precision <= 0 ? `${Math.round(numeric)}%` : `${numeric.toFixed(precision)}%`;
}

export function formatMonths(value: number | null | undefined) {
  return Number.isFinite(value ?? NaN)
    ? `${oneDecimalFormatter.format(Number(value))} months`
    : "N/A";
}

export function formatMultiple(value: number | null | undefined) {
  return Number.isFinite(value ?? NaN)
    ? `${oneDecimalFormatter.format(Number(value))}x`
    : "N/A";
}
