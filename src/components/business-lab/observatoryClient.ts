import {
  PILLAR_ORDER,
  clampScore,
  formatWholeNumber,
  getRiskBand,
  pillarKey,
  polygonPoints,
  type ObservatoryMetric,
  type ObservatoryModel,
  type ObservatorySignal,
  type PillarName,
} from "./observatoryLogic";

type SignalFilter = "All" | PillarName;
type PanelState = "collapsed" | "expanded";

class CollapsiblePanelController {
  private readonly root: HTMLElement;
  private readonly button: HTMLButtonElement | null;
  private readonly bodyShell: HTMLElement | null;
  private readonly panelId: string;
  private readonly panelLabel: string;
  private collapsed: boolean;

  constructor(root: HTMLElement) {
    this.root = root;
    this.button = root.querySelector<HTMLButtonElement>("[data-panel-toggle]");
    this.bodyShell = root.querySelector<HTMLElement>("[data-panel-body-shell]");
    this.panelId = root.dataset.panelId || "panel";
    this.panelLabel = root.dataset.panelLabel || "panel";
    this.collapsed = root.dataset.defaultCollapsed === "true";
  }

  init() {
    if (!this.button || !this.bodyShell) {
      return;
    }

    this.collapsed = this.readPersistedState() ?? this.collapsed;
    this.button.addEventListener("click", () => {
      this.setCollapsed(!this.collapsed);
    });
    this.render();
  }

  private get storageKey() {
    return `nsbs:business-lab:${this.panelId}:state`;
  }

  private readPersistedState() {
    try {
      const persisted = window.sessionStorage.getItem(this.storageKey);

      if (persisted === "collapsed") {
        return true;
      }

      if (persisted === "expanded") {
        return false;
      }
    } catch {
      return null;
    }

    return null;
  }

  private persistState() {
    try {
      const value: PanelState = this.collapsed ? "collapsed" : "expanded";
      window.sessionStorage.setItem(this.storageKey, value);
    } catch {
      return;
    }
  }

  private setCollapsed(nextCollapsed: boolean) {
    this.collapsed = nextCollapsed;
    this.persistState();
    this.render();
  }

  private render() {
    if (!this.button || !this.bodyShell) {
      return;
    }

    const expanded = !this.collapsed;
    const nextLabel = expanded ? "Collapse" : "Expand";

    this.root.dataset.collapsed = String(this.collapsed);
    this.button.setAttribute("aria-expanded", String(expanded));
    this.button.setAttribute("aria-label", `${nextLabel} ${this.panelLabel}`);

    const label = this.button.querySelector<HTMLElement>("[data-panel-toggle-label]");
    if (label) {
      label.textContent = nextLabel;
    }

    this.bodyShell.setAttribute("aria-hidden", String(this.collapsed));
    this.bodyShell.toggleAttribute("hidden", false);

    if (this.collapsed) {
      this.bodyShell.setAttribute("inert", "");
    } else {
      this.bodyShell.removeAttribute("inert");
    }
  }
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function metricStatusClass(status: string) {
  return status.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function metricCardMarkup(metric: ObservatoryMetric) {
  const sourceMarkup = metric.sourceUrl
    ? `
        <a
          class="obs-metric-source"
          href="${escapeHtml(metric.sourceUrl)}"
          target="_blank"
          rel="noreferrer noopener"
          title="${escapeHtml(metric.sourceLabel)}"
        >
          ${escapeHtml(metric.sourceLabel)}
          <span aria-hidden="true">↗</span>
        </a>
      `
    : `<span class="obs-metric-source">${escapeHtml(metric.sourceLabel)}</span>`;

  return `
    <article class="obs-metric-card card">
      <p class="obs-metric-label">${escapeHtml(metric.label)}</p>
      <div class="obs-metric-value-row">
        <p class="obs-metric-value">${escapeHtml(metric.value)}</p>
        ${metric.unit ? `<p class="obs-metric-unit">${escapeHtml(metric.unit)}</p>` : ""}
        <span class="obs-metric-status obs-metric-status--${metricStatusClass(metric.status)}">
          ${escapeHtml(metric.status)}
        </span>
      </div>
      ${metric.trendLabel ? `<p class="obs-metric-trend">${escapeHtml(metric.trendLabel)}</p>` : ""}
      <div class="obs-metric-meta-row">
        <p class="obs-metric-meta">Updated ${escapeHtml(metric.timeframe)}</p>
        ${sourceMarkup}
      </div>
    </article>
  `;
}

function signalRowMarkup(signal: ObservatorySignal) {
  const sourceMarkup = signal.sourceUrl
    ? `
        <a
          class="obs-feed-source"
          href="${escapeHtml(signal.sourceUrl)}"
          target="_blank"
          rel="noreferrer noopener"
        >
          ${escapeHtml(signal.sourceLabel)}
          <span aria-hidden="true">↗</span>
        </a>
      `
    : `<span class="obs-feed-source">${escapeHtml(signal.sourceLabel)}</span>`;

  return `
    <li class="obs-feed-row" data-signal-item data-signal-pillar="${escapeHtml(signal.pillar)}">
      <div class="obs-feed-row-top">
        <span class="obs-feed-date">${escapeHtml(signal.dateLabel)}</span>
        <span class="obs-feed-pillar" data-pillar="${escapeHtml(pillarKey(signal.pillar))}">
          ${escapeHtml(signal.pillar)}
        </span>
      </div>
      <h3 class="obs-feed-title">${escapeHtml(signal.title)}</h3>
      <p class="obs-feed-summary">${escapeHtml(signal.summary)}</p>
      ${sourceMarkup}
    </li>
  `;
}

class WorkforceObservatoryController {
  private readonly root: HTMLElement;
  private readonly model: ObservatoryModel;
  private readonly compositeScoreEl: HTMLElement;
  private readonly compositeBandEl: HTMLElement;
  private readonly compositeConfidenceEl: HTMLElement | null;
  private readonly pentagonShapeEl: SVGElement;
  private readonly pillarButtons: HTMLElement[];
  private readonly pillarTabs: HTMLElement[];
  private readonly detailTitleEl: HTMLElement | null;
  private readonly detailPillarBulletEl: HTMLElement | null;
  private readonly detailBandEl: HTMLElement | null;
  private readonly detailBandScaleEl: HTMLElement | null;
  private readonly detailSummaryEl: HTMLElement | null;
  private readonly detailEmployerBulletsEl: HTMLElement | null;
  private readonly detailActionsEl: HTMLElement | null;
  private readonly detailSourceChipsEl: HTMLElement | null;
  private readonly detailSourceUpdatedEl: HTMLElement | null;
  private readonly metricsPillarLabelEl: HTMLElement | null;
  private readonly metricsGridEl: HTMLElement | null;
  private readonly metricsEmptyEl: HTMLElement | null;
  private readonly metricsToggleEl: HTMLElement | null;
  private readonly signalFilters: HTMLElement[];
  private readonly signalListEl: HTMLElement | null;
  private readonly axisByPillar = new Map<PillarName, Element>();
  private readonly nodeByPillar = new Map<PillarName, SVGElement>();
  private readonly labelByPillar = new Map<PillarName, Element>();
  private readonly state: {
    selectedPillar: PillarName;
    hoverPillar: PillarName | null;
    signalFilter: SignalFilter;
    showAllPillarsMetrics: boolean;
  };

  constructor(root: HTMLElement, model: ObservatoryModel) {
    this.root = root;
    this.model = model;
    this.state = {
      selectedPillar: PILLAR_ORDER[0],
      hoverPillar: null,
      signalFilter: "All",
      showAllPillarsMetrics: false,
    };

    this.compositeScoreEl = this.must("[data-composite-score]");
    this.compositeBandEl = this.must("[data-composite-band]");
    this.compositeConfidenceEl = this.root.querySelector("[data-composite-confidence]");
    this.pentagonShapeEl = this.mustSvg("[data-pentagon-shape]");
    this.pillarButtons = Array.from(this.root.querySelectorAll<HTMLElement>("[data-pillar-button]"));
    this.pillarTabs = Array.from(this.root.querySelectorAll<HTMLElement>("[data-pillar-tab]"));
    this.detailTitleEl = this.root.querySelector("[data-detail-title]");
    this.detailPillarBulletEl = this.root.querySelector("[data-detail-pillar-bullet]");
    this.detailBandEl = this.root.querySelector("[data-detail-band]");
    this.detailBandScaleEl = this.root.querySelector("[data-detail-band-scale]");
    this.detailSummaryEl = this.root.querySelector("[data-detail-summary]");
    this.detailEmployerBulletsEl = this.root.querySelector("[data-detail-employer-bullets]");
    this.detailActionsEl = this.root.querySelector("[data-detail-actions]");
    this.detailSourceChipsEl = this.root.querySelector("[data-detail-source-chips]");
    this.detailSourceUpdatedEl = this.root.querySelector("[data-detail-source-updated]");
    this.metricsPillarLabelEl = this.root.querySelector("[data-metrics-pillar-label]");
    this.metricsGridEl = this.root.querySelector("[data-metrics-grid]");
    this.metricsEmptyEl = this.root.querySelector("[data-metrics-empty]");
    this.metricsToggleEl = this.root.querySelector("[data-metrics-toggle]");
    this.signalFilters = Array.from(this.root.querySelectorAll<HTMLElement>("[data-signal-filter]"));
    this.signalListEl = this.root.querySelector("[data-signal-list]");

    PILLAR_ORDER.forEach((pillar) => {
      const axis = this.root.querySelector(`[data-pentagon-axis="${pillar}"]`);
      const node = this.root.querySelector<SVGElement>(`[data-pentagon-node="${pillar}"]`);
      const label = this.root.querySelector(`[data-pillar-label="${pillar}"]`);

      if (axis) {
        this.axisByPillar.set(pillar, axis);
      }

      if (node) {
        this.nodeByPillar.set(pillar, node);
      }

      if (label) {
        this.labelByPillar.set(pillar, label);
      }
    });
  }

  init() {
    this.readQuery();
    this.bindEvents();
    this.renderAll();
  }

  private must(selector: string) {
    const element = this.root.querySelector<HTMLElement>(selector);

    if (!element) {
      throw new Error(`Workforce Observatory element missing: ${selector}`);
    }

    return element;
  }

  private mustSvg(selector: string) {
    const element = this.root.querySelector<SVGElement>(selector);

    if (!element) {
      throw new Error(`Workforce Observatory SVG element missing: ${selector}`);
    }

    return element;
  }

  private readQuery() {
    const pillar = new URLSearchParams(window.location.search).get("pillar");

    if (pillar && PILLAR_ORDER.includes(pillar as PillarName)) {
      this.state.selectedPillar = pillar as PillarName;
      return;
    }

    this.state.selectedPillar = PILLAR_ORDER[0];
  }

  private bindEvents() {
    this.pillarButtons.forEach((button) => {
      const pillar = button.dataset.pillarButton;

      if (!pillar || !PILLAR_ORDER.includes(pillar as PillarName)) {
        return;
      }

      const typedPillar = pillar as PillarName;
      button.addEventListener("mouseenter", () => {
        this.state.hoverPillar = typedPillar;
        this.renderPentagon();
        this.renderDetailPanel();
      });
      button.addEventListener("mouseleave", () => {
        this.state.hoverPillar = null;
        this.renderPentagon();
        this.renderDetailPanel();
      });
      button.addEventListener("focus", () => {
        this.state.hoverPillar = typedPillar;
        this.renderPentagon();
        this.renderDetailPanel();
      });
      button.addEventListener("blur", () => {
        this.state.hoverPillar = null;
        this.renderPentagon();
        this.renderDetailPanel();
      });
      button.addEventListener("click", () => {
        this.selectPillar(typedPillar);
      });
      button.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        this.selectPillar(typedPillar);
      });
    });

    this.pillarTabs.forEach((tab) => {
      const pillar = tab.dataset.pillarTab;

      if (!pillar || !PILLAR_ORDER.includes(pillar as PillarName)) {
        return;
      }

      const typedPillar = pillar as PillarName;
      tab.addEventListener("click", () => {
        this.selectPillar(typedPillar);
      });
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        this.selectPillar(typedPillar);
      });
    });

    this.metricsToggleEl?.addEventListener("click", () => {
      this.state.showAllPillarsMetrics = !this.state.showAllPillarsMetrics;
      this.metricsToggleEl?.setAttribute("aria-pressed", String(this.state.showAllPillarsMetrics));
      this.renderMetricsPanel();
    });

    this.signalFilters.forEach((button) => {
      button.addEventListener("click", () => {
        const filter = (button.dataset.signalFilter || "All") as SignalFilter;
        this.state.signalFilter = filter;
        this.renderSignalFeed();
      });
    });

    window.addEventListener("popstate", () => {
      this.readQuery();
      this.renderAll();
    });
  }

  private getActivePillar() {
    return this.state.hoverPillar || this.state.selectedPillar || PILLAR_ORDER[0];
  }

  private getBaseScores() {
    return PILLAR_ORDER.reduce(
      (scores, pillar) => {
        scores[pillar] = clampScore(Number(this.model.pillars[pillar]?.score ?? 0));
        return scores;
      },
      {} as Record<PillarName, number>,
    );
  }

  private renderAll() {
    this.renderPentagon();
    this.renderPillarTabs();
    this.renderDetailPanel();
    this.renderMetricsPanel();
    this.renderSignalFeed();
  }

  private renderPentagon() {
    const scores = this.getBaseScores();
    const activePillar = this.getActivePillar();

    this.pentagonShapeEl.setAttribute("points", polygonPoints(scores));

    const compositeScore = Number(this.model.composite?.score ?? NaN);
    if (Number.isFinite(compositeScore)) {
      const risk = getRiskBand(compositeScore);
      this.compositeScoreEl.textContent = formatWholeNumber(compositeScore);
      this.compositeBandEl.textContent = risk.label;
      this.compositeBandEl.className = `obs-risk-band obs-risk-band--${risk.band}`;
    } else {
      this.compositeScoreEl.textContent = "N/A";
      this.compositeBandEl.textContent = "Insufficient data";
      this.compositeBandEl.className = "obs-risk-band obs-risk-band--neutral";
    }

    if (this.compositeConfidenceEl) {
      this.compositeConfidenceEl.textContent = `Confidence ${String(this.model.confidence || "unknown").toUpperCase()}`;
    }

    PILLAR_ORDER.forEach((pillar) => {
      const normalizedScore = clampScore(scores[pillar]);
      const risk = getRiskBand(normalizedScore);
      const isActive = pillar === activePillar;
      const isSelected = pillar === this.state.selectedPillar;
      const button = this.pillarButtons.find((entry) => entry.dataset.pillarButton === pillar);

      if (button) {
        button.classList.toggle("is-active", isActive);
        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
        button.setAttribute(
          "aria-label",
          `${pillar} pillar. Score ${formatWholeNumber(normalizedScore)} out of 100. ${risk.label.toLowerCase()}.`,
        );
      }

      this.axisByPillar.get(pillar)?.classList.toggle("is-active", isActive);
      this.nodeByPillar.get(pillar)?.classList.toggle("is-active", isActive);
      this.labelByPillar.get(pillar)?.classList.toggle("is-active", isActive);
      this.labelByPillar.get(pillar)?.classList.toggle("is-selected", isSelected);
    });
  }

  private selectPillar(pillar: PillarName) {
    if (this.state.selectedPillar === pillar) {
      return;
    }

    this.state.selectedPillar = pillar;
    this.syncQuery(false);
    this.renderPentagon();
    this.renderPillarTabs();
    this.renderDetailPanel();
    this.renderMetricsPanel();
  }

  private renderPillarTabs() {
    const selectedPillar = this.state.selectedPillar;

    this.pillarTabs.forEach((tab) => {
      const pillar = tab.dataset.pillarTab as PillarName | undefined;
      const isSelected = Boolean(pillar && selectedPillar === pillar);

      tab.setAttribute("aria-selected", String(isSelected));
      tab.setAttribute("aria-pressed", String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
      tab.classList.toggle("is-selected", isSelected);
    });
  }

  private renderDetailPanel() {
    const activePillar = this.getActivePillar();
    const pillar = this.model.pillars[activePillar];

    if (!pillar) {
      return;
    }

    const pillarToken = pillarKey(activePillar);

    if (this.detailTitleEl) {
      this.detailTitleEl.textContent = pillar.title;
      this.detailTitleEl.dataset.pillar = pillarToken;
    }

    if (this.detailPillarBulletEl) {
      this.detailPillarBulletEl.dataset.pillar = pillarToken;
    }

    if (this.detailBandEl) {
      this.detailBandEl.textContent = formatWholeNumber(pillar.score);
    }

    if (this.detailBandScaleEl) {
      this.detailBandScaleEl.textContent = Number.isFinite(pillar.score) ? " / 100" : "";
    }

    if (this.detailSummaryEl) {
      this.detailSummaryEl.textContent = pillar.signalSummary;
    }

    if (this.detailEmployerBulletsEl) {
      this.detailEmployerBulletsEl.innerHTML = pillar.employerImplications
        .slice(0, 3)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
    }

    if (this.detailActionsEl) {
      this.detailActionsEl.innerHTML = pillar.recommendedActions
        .slice(0, 3)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
    }

    if (this.detailSourceChipsEl) {
      const chips = pillar.sourceChips.slice(0, 6);
      this.detailSourceChipsEl.innerHTML = chips
        .map((chip) => `<span class="obs-source-chip">${escapeHtml(chip)}</span>`)
        .join("");
      this.detailSourceChipsEl.hidden = chips.length === 0;
    }

    if (this.detailSourceUpdatedEl) {
      const hasUpdate = Boolean(
        pillar.sourceUpdatedLabel && pillar.sourceUpdatedLabel !== "Unknown",
      );
      this.detailSourceUpdatedEl.textContent = hasUpdate
        ? `Last updated: ${pillar.sourceUpdatedLabel}`
        : "";
      this.detailSourceUpdatedEl.hidden = !hasUpdate;
    }
  }

  private renderMetricsPanel() {
    if (!this.metricsGridEl) {
      return;
    }

    const activePillar = this.getActivePillar();
    const selectedMetrics = this.model.pillars[activePillar]?.metrics || [];
    const allMetrics = PILLAR_ORDER.flatMap((pillar) => this.model.pillars[pillar]?.metrics || []);
    const metrics = this.state.showAllPillarsMetrics ? allMetrics : selectedMetrics;
    const visibleMetrics = metrics.slice(0, this.state.showAllPillarsMetrics ? 15 : 6);

    if (this.metricsPillarLabelEl) {
      this.metricsPillarLabelEl.textContent = this.state.showAllPillarsMetrics
        ? "All Pillars"
        : activePillar;
    }

    if (this.metricsToggleEl) {
      this.metricsToggleEl.textContent = this.state.showAllPillarsMetrics
        ? "View selected pillar"
        : "View all pillars";
      this.metricsToggleEl.setAttribute("aria-pressed", String(this.state.showAllPillarsMetrics));
    }

    if (!visibleMetrics.length) {
      this.metricsGridEl.innerHTML = "";
      if (this.metricsEmptyEl) {
        this.metricsEmptyEl.hidden = false;
      }
      return;
    }

    this.metricsGridEl.innerHTML = visibleMetrics.map((metric) => metricCardMarkup(metric)).join("");

    if (this.metricsEmptyEl) {
      this.metricsEmptyEl.hidden = true;
    }
  }

  private renderSignalFeed() {
    this.signalFilters.forEach((button) => {
      const isActive = (button.dataset.signalFilter || "All") === this.state.signalFilter;
      button.setAttribute("aria-pressed", String(isActive));
      button.setAttribute("aria-selected", String(isActive));
      button.classList.toggle("is-selected", isActive);
    });

    if (!this.signalListEl) {
      return;
    }

    const signals = (this.model.signals || []).filter((signal) =>
      this.state.signalFilter === "All" ? true : signal.pillar === this.state.signalFilter,
    );

    this.signalListEl.innerHTML = signals.length
      ? signals.map((signal) => signalRowMarkup(signal)).join("")
      : '<li class="obs-feed-row obs-feed-row--empty">No signal entries are available for this filter.</li>';
  }

  private syncQuery(replace = true) {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("pillar", this.state.selectedPillar);

    const query = searchParams.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`;

    if (replace) {
      window.history.replaceState({}, "", nextUrl);
      return;
    }

    window.history.pushState({}, "", nextUrl);
  }
}

function readObservatoryModel() {
  const element = document.getElementById("observatory-view-model");

  if (!element?.textContent) {
    return null;
  }

  try {
    return JSON.parse(element.textContent) as ObservatoryModel;
  } catch {
    return null;
  }
}

export function initWorkforceObservatory() {
  const model = readObservatoryModel();

  if (!model) {
    return;
  }

  document.querySelectorAll<HTMLElement>("[data-observatory-dashboard]").forEach((root) => {
    if (root.dataset.observatoryBooted === "true") {
      return;
    }

    root.dataset.observatoryBooted = "true";
    root.querySelectorAll<HTMLElement>("[data-collapsible-panel]").forEach((panel) => {
      new CollapsiblePanelController(panel).init();
    });
    new WorkforceObservatoryController(root, model).init();
  });
}
