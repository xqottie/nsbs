import {
  ROI_DEFAULTS,
  ROI_SCENARIOS,
  ROI_SCENARIO_ORDER,
  calculateRoi,
  compareRoiScenarios,
  formatCompactCurrency,
  formatCurrency,
  formatMonths,
  formatMultiple,
  formatPercent,
  sanitizeRoiInputs,
  type RoiInputValues,
  type RoiScenarioKey,
} from "./roiEstimatorLogic";

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const animationState = new WeakMap<HTMLElement, { value: number; frame: number | null }>();

function sparklinePoints(value: number, total: number, index: number) {
  const offset = 4 + (total > 0 ? (value / total) * 14 : 0);
  const templates = [
    [0.25, 0.56, 0.48, 0.82, 0.7],
    [0.22, 0.42, 0.67, 0.58, 0.84],
    [0.34, 0.6, 0.44, 0.74, 0.62],
    [0.2, 0.52, 0.72, 0.5, 0.78],
  ];
  const selectedTemplate = templates[index] || templates[0];

  return selectedTemplate
    .map((step, pointIndex) => {
      const x = 8 + pointIndex * 21;
      const y = 26 - offset * step;
      return `${x},${y.toFixed(1)}`;
    })
    .join(" ");
}

function formatValueForOutput(
  value: number | null | undefined,
  format: string | null | undefined,
) {
  switch (format) {
    case "compactCurrency":
      return formatCompactCurrency(value);
    case "multiple":
      return formatMultiple(value);
    case "months":
      return formatMonths(value);
    default:
      return formatCurrency(value);
  }
}

function setAnimatedText(
  element: HTMLElement,
  value: number | null | undefined,
  format: string | null | undefined,
) {
  if (!Number.isFinite(value ?? NaN) || format === "multiple" || format === "months" || prefersReducedMotion) {
    element.textContent = formatValueForOutput(value, format);
    if (Number.isFinite(value ?? NaN)) {
      animationState.set(element, {
        value: Number(value),
        frame: null,
      });
    }
    return;
  }

  const nextValue = Number(value);
  const priorState = animationState.get(element);
  const previousValue = priorState && Number.isFinite(priorState.value) ? priorState.value : nextValue;

  if (priorState?.frame) {
    window.cancelAnimationFrame(priorState.frame);
  }

  if (Math.abs(nextValue - previousValue) < 1) {
    element.textContent = formatValueForOutput(nextValue, format);
    animationState.set(element, {
      value: nextValue,
      frame: null,
    });
    return;
  }

  const startedAt = performance.now();
  const duration = 340;

  const animate = (timestamp: number) => {
    const progress = Math.min(1, (timestamp - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentValue = previousValue + (nextValue - previousValue) * eased;
    element.textContent = formatValueForOutput(currentValue, format);

    if (progress < 1) {
      const nextState = animationState.get(element) ?? {
        value: previousValue,
        frame: null,
      };
      nextState.frame = window.requestAnimationFrame(animate);
      nextState.value = currentValue;
      animationState.set(element, nextState);
      return;
    }

    element.textContent = formatValueForOutput(nextValue, format);
    animationState.set(element, {
      value: nextValue,
      frame: null,
    });
  };

  const frame = window.requestAnimationFrame(animate);
  animationState.set(element, {
    value: previousValue,
    frame,
  });
}

class RoiEstimatorController {
  private readonly root: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly liveNoteEl: HTMLElement | null;
  private readonly realtimeStateEl: HTMLElement | null;
  private readonly scenarioChipEl: HTMLElement | null;
  private readonly programNoteEl: HTMLElement | null;
  private readonly programCardEls: HTMLElement[];
  private readonly outputEls: HTMLElement[];
  private readonly displayEls: HTMLElement[];
  private readonly shareEls: HTMLElement[];
  private readonly sparklineEls: SVGPolylineElement[];
  private readonly legendValueEls: HTMLElement[];
  private readonly breakdownSegments: HTMLElement[];
  private readonly breakdownSummaryEl: HTMLElement | null;
  private readonly scenarioSummaryEl: HTMLElement | null;
  private readonly scenarioBarEls: HTMLElement[];
  private readonly scenarioColumnEls: HTMLElement[];
  private readonly scenarioValueEls: HTMLElement[];
  private readonly resetButton: HTMLElement | null;
  private readonly detailsEls: HTMLDetailsElement[];

  constructor(root: HTMLElement) {
    this.root = root;

    const form = root.querySelector<HTMLFormElement>("[data-roi-form]");
    if (!form) {
      throw new Error("ROI estimator form not found");
    }

    this.form = form;
    this.liveNoteEl = root.querySelector("[data-roi-live-note]");
    this.realtimeStateEl = root.querySelector("[data-roi-realtime-state]");
    this.scenarioChipEl = root.querySelector("[data-roi-scenario-chip] strong");
    this.programNoteEl = root.querySelector("[data-roi-program-note]");
    this.programCardEls = Array.from(root.querySelectorAll<HTMLElement>("[data-roi-program-card]"));
    this.outputEls = Array.from(root.querySelectorAll<HTMLElement>("[data-roi-output]"));
    this.displayEls = Array.from(root.querySelectorAll<HTMLElement>("[data-roi-display]"));
    this.shareEls = Array.from(root.querySelectorAll<HTMLElement>("[data-roi-share]"));
    this.sparklineEls = Array.from(root.querySelectorAll<SVGPolylineElement>("[data-roi-sparkline]"));
    this.legendValueEls = Array.from(
      root.querySelectorAll<HTMLElement>("[data-roi-breakdown-legend-value]"),
    );
    this.breakdownSegments = Array.from(
      root.querySelectorAll<HTMLElement>("[data-roi-breakdown-segment]"),
    );
    this.breakdownSummaryEl = root.querySelector("[data-roi-breakdown-summary]");
    this.scenarioSummaryEl = root.querySelector("[data-roi-scenario-summary]");
    this.scenarioBarEls = Array.from(root.querySelectorAll<HTMLElement>("[data-roi-scenario-bar]"));
    this.scenarioColumnEls = Array.from(root.querySelectorAll<HTMLElement>("[data-roi-scenario-column]"));
    this.scenarioValueEls = Array.from(root.querySelectorAll<HTMLElement>("[data-roi-scenario-value]"));
    this.resetButton = root.querySelector("[data-roi-reset]");
    this.detailsEls = Array.from(root.querySelectorAll<HTMLDetailsElement>("[data-roi-details]"));
  }

  init() {
    this.bindEvents();
    this.syncDetails();

    const inputs = this.readInputs();
    this.syncDisplays(inputs);
    this.render(inputs);
  }

  private bindEvents() {
    this.form.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const inputs = this.readInputs();
      this.syncDisplays(inputs);

      if (target instanceof HTMLInputElement && target.name === "realtimeUpdates" && inputs.realtimeUpdates) {
        this.render(inputs);
        return;
      }

      if (inputs.realtimeUpdates) {
        this.render(inputs);
      }
    });

    this.form.addEventListener("change", () => {
      const inputs = this.readInputs();
      this.syncDisplays(inputs);
      if (inputs.realtimeUpdates) {
        this.render(inputs);
      }
    });

    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      const inputs = this.readInputs();
      this.syncDisplays(inputs);
      this.render(inputs);
    });

    this.resetButton?.addEventListener("click", () => {
      this.resetToDefaults();
    });

    this.detailsEls.forEach((details) => {
      const summary = details.querySelector("summary");
      if (!summary) {
        return;
      }

      summary.setAttribute("aria-expanded", String(details.open));
      details.addEventListener("toggle", () => {
        summary.setAttribute("aria-expanded", String(details.open));
      });
    });
  }

  private resetToDefaults() {
    this.setInputValue("workforceSize", String(ROI_DEFAULTS.workforceSize));
    this.setInputValue("averageSalary", String(ROI_DEFAULTS.averageSalary));
    this.setInputValue("turnoverRate", String(ROI_DEFAULTS.turnoverRate));
    this.setInputValue("replacementCostRate", String(ROI_DEFAULTS.replacementCostRate));
    this.setInputValue("absenteeDaysPerEmployee", String(ROI_DEFAULTS.absenteeDaysPerEmployee));
    this.setInputValue("engagementImprovement", String(ROI_DEFAULTS.engagementImprovement));
    this.setInputValue("programCost", "");
    this.setInputValue("workdaysPerYear", String(ROI_DEFAULTS.workdaysPerYear));
    this.setInputValue("absenteeCostMultiplier", String(ROI_DEFAULTS.absenteeCostMultiplier));
    this.setInputValue("impactCapAdjustment", String(ROI_DEFAULTS.impactCapAdjustment));
    this.setCheckedValue("realtimeUpdates", ROI_DEFAULTS.realtimeUpdates);
    this.setScenario(ROI_DEFAULTS.scenario);

    const inputs = this.readInputs();
    this.syncDisplays(inputs);
    this.render(inputs);
  }

  private setInputValue(name: string, value: string) {
    const input = this.form.elements.namedItem(name);
    if (input instanceof HTMLInputElement) {
      input.value = value;
    }
  }

  private setCheckedValue(name: string, checked: boolean) {
    const input = this.form.elements.namedItem(name);
    if (input instanceof HTMLInputElement) {
      input.checked = checked;
    }
  }

  private setScenario(scenario: RoiScenarioKey) {
    const input = this.form.querySelector<HTMLInputElement>(
      `input[name="scenario"][value="${scenario}"]`,
    );
    if (input) {
      input.checked = true;
    }
  }

  private readInputs() {
    const scenarioInput = this.form.querySelector<HTMLInputElement>('input[name="scenario"]:checked');
    const programCostInput = this.form.elements.namedItem("programCost");
    const realtimeUpdatesInput = this.form.elements.namedItem("realtimeUpdates");

    return sanitizeRoiInputs({
      workforceSize: this.readValue("workforceSize"),
      averageSalary: this.readValue("averageSalary"),
      turnoverRate: this.readValue("turnoverRate"),
      replacementCostRate: this.readValue("replacementCostRate"),
      absenteeDaysPerEmployee: this.readValue("absenteeDaysPerEmployee"),
      workdaysPerYear: this.readValue("workdaysPerYear"),
      engagementImprovement: this.readValue("engagementImprovement"),
      scenario: scenarioInput?.value,
      programCost: programCostInput instanceof HTMLInputElement ? programCostInput.value : null,
      absenteeCostMultiplier: this.readValue("absenteeCostMultiplier"),
      impactCapAdjustment: this.readValue("impactCapAdjustment"),
      realtimeUpdates:
        realtimeUpdatesInput instanceof HTMLInputElement ? realtimeUpdatesInput.checked : true,
    });
  }

  private readValue(name: string) {
    const input = this.form.elements.namedItem(name);
    return input instanceof HTMLInputElement ? input.value : "";
  }

  private syncDisplays(inputs: ReturnType<typeof sanitizeRoiInputs>) {
    this.displayEls.forEach((display) => {
      const key = display.dataset.roiDisplay as keyof RoiInputValues | undefined;
      if (
        key === "turnoverRate" ||
        key === "replacementCostRate" ||
        key === "engagementImprovement"
      ) {
        const value = inputs[key];
        display.textContent = `${Math.round(Number(value))}%`;
      }
    });

    if (this.liveNoteEl) {
      this.liveNoteEl.textContent = inputs.realtimeUpdates
        ? "Updating live as inputs change."
        : "Live updates are paused. Use Calculate Impact to refresh the projection.";
    }

    if (this.realtimeStateEl) {
      this.realtimeStateEl.textContent = inputs.realtimeUpdates ? "On" : "Off";
    }
  }

  private render(inputs: ReturnType<typeof sanitizeRoiInputs>) {
    const result = calculateRoi(inputs);
    const scenarios = compareRoiScenarios(inputs);
    const outputMap = this.createOutputMap(result);

    this.outputEls.forEach((element) => {
      const key = element.dataset.roiOutput;
      if (!key) {
        return;
      }

      const value = outputMap[key] ?? null;
      setAnimatedText(element, typeof value === "number" ? value : null, element.dataset.roiFormat);
    });

    if (this.scenarioChipEl) {
      this.scenarioChipEl.textContent = result.scenario.label;
    }

    const hasProgramCost = Boolean(result.inputs.programCost && result.inputs.programCost > 0);
    this.programCardEls.forEach((card) => {
      card.hidden = !hasProgramCost;
    });

    if (this.programNoteEl) {
      this.programNoteEl.hidden = hasProgramCost;
    }

    const breakdown = [
      {
        key: "turnoverSavings",
        value: result.components.turnoverSavings,
      },
      {
        key: "productivityValue",
        value: result.components.productivityValue,
      },
      {
        key: "absenteeSavings",
        value: result.components.absenteeSavings,
      },
      {
        key: "disengagementSavings",
        value: result.components.disengagementSavings,
      },
    ];
    const totalValue = Math.max(result.totals.totalValue, 0);

    this.shareEls.forEach((element) => {
      const key = element.dataset.roiShare;
      const item = breakdown.find((entry) => entry.key === key);
      const share = item && totalValue > 0 ? (item.value / totalValue) * 100 : 0;
      element.textContent = `${formatPercent(share)} of total value`;
    });

    this.sparklineEls.forEach((polyline, index) => {
      const key = polyline.dataset.roiSparkline;
      const item = breakdown.find((entry) => entry.key === key);
      polyline.setAttribute("points", sparklinePoints(item?.value ?? 0, totalValue, index));
    });

    this.legendValueEls.forEach((element) => {
      const key = element.dataset.roiBreakdownLegendValue;
      const item = breakdown.find((entry) => entry.key === key);
      element.textContent = formatCurrency(item?.value ?? 0);
    });

    this.breakdownSegments.forEach((segment) => {
      const key = segment.dataset.roiBreakdownSegment;
      const item = breakdown.find((entry) => entry.key === key);
      const share = item && totalValue > 0 ? item.value / totalValue : 0;
      segment.style.setProperty("--segment-share", String(share));
    });

    if (this.breakdownSummaryEl) {
      this.breakdownSummaryEl.textContent = `${formatCurrency(result.components.turnoverSavings)} from turnover, ${formatCurrency(result.components.productivityValue)} from productivity, ${formatCurrency(result.components.absenteeSavings)} from absenteeism, and ${formatCurrency(result.components.disengagementSavings)} from disengagement recovery.`;
    }

    const scenarioRows = ROI_SCENARIO_ORDER.map((scenario) => ({
      key: scenario,
      label: ROI_SCENARIOS[scenario].label,
      value: scenarios[scenario].totals.totalValue,
    }));
    const maxScenarioValue = Math.max(...scenarioRows.map((item) => item.value), 1);

    this.scenarioBarEls.forEach((bar) => {
      const key = bar.dataset.roiScenarioBar as RoiScenarioKey | undefined;
      if (!key) {
        return;
      }

      const isSelected = key === result.scenario.key;
      bar.classList.toggle("is-selected", isSelected);
      bar.dataset.roiSelected = isSelected ? "true" : "false";
      bar.setAttribute("aria-current", isSelected ? "true" : "false");
    });

    this.scenarioColumnEls.forEach((column) => {
      const key = column.dataset.roiScenarioColumn as RoiScenarioKey | undefined;
      if (!key) {
        return;
      }

      const entry = scenarioRows.find((item) => item.key === key);
      const scale = entry ? entry.value / maxScenarioValue : 0;
      column.style.setProperty("--bar-scale", String(scale));
    });

    this.scenarioValueEls.forEach((valueEl) => {
      const key = valueEl.dataset.roiScenarioValue as RoiScenarioKey | undefined;
      if (!key) {
        return;
      }

      const entry = scenarioRows.find((item) => item.key === key);
      valueEl.textContent = formatCompactCurrency(entry?.value ?? 0);
    });

    if (this.scenarioSummaryEl) {
      this.scenarioSummaryEl.textContent = scenarioRows
        .map((entry) => `${entry.label}: ${formatCurrency(entry.value)}`)
        .join(". ");
    }
  }

  private createOutputMap(result: ReturnType<typeof calculateRoi>) {
    return {
      totalValue: result.totals.totalValue,
      valuePerEmployee: result.totals.valuePerEmployee,
      roiMultiple: result.totals.roiMultiple,
      paybackMonths: result.totals.paybackMonths,
      turnoverSavings: result.components.turnoverSavings,
      productivityValue: result.components.productivityValue,
      absenteeSavings: result.components.absenteeSavings,
      disengagementSavings: result.components.disengagementSavings,
      totalValueCompact: result.totals.totalValue,
    } satisfies Record<string, number | null>;
  }

  private syncDetails() {
    this.detailsEls.forEach((details) => {
      const summary = details.querySelector("summary");
      if (summary) {
        summary.setAttribute("aria-expanded", String(details.open));
      }
    });
  }
}

export function initRoiEstimator() {
  document.querySelectorAll<HTMLElement>("[data-roi-estimator]").forEach((root) => {
    if (root.dataset.roiBooted === "true") {
      return;
    }

    root.dataset.roiBooted = "true";
    new RoiEstimatorController(root).init();
  });
}
