interface InitPdfConfig {
  rootId: string;
}

const PDF_RENDER_WIDTH = 794;
const PDF_RENDER_HEIGHT = 1123;
const EXPORT_ROOT_ID = "pdfExport";
const HTML2CANVAS_TIMEOUT_MS = 20_000;

type Html2CanvasModule = typeof import("html2canvas").default;
type JsPdfCtor = typeof import("jspdf").jsPDF;

declare global {
  interface Window {
    html2canvas?: Html2CanvasModule;
    jspdf?: {
      jsPDF?: JsPdfCtor;
    };
  }
}

let pdfModulesPromise:
  | Promise<{
      html2canvas: Html2CanvasModule;
      jsPDF: JsPdfCtor;
    }>
  | null = null;

const loadPdfModules = async () => {
  if (!pdfModulesPromise) {
    pdfModulesPromise = (async () => {
      if (!window.html2canvas || !window.jspdf?.jsPDF) {
        throw new Error("PDF libraries are unavailable on this page.");
      }

      return {
        html2canvas: window.html2canvas,
        jsPDF: window.jspdf.jsPDF,
      };
    })();
  }

  return pdfModulesPromise;
};

const waitForPaint = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

const waitForFonts = async () => {
  if (!document.fonts?.ready) {
    return;
  }

  await Promise.race([
    document.fonts.ready.then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
  ]);
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string) => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    }),
  ]);
};

type ExportPillarId = "social" | "purpose" | "achievement" | "risk" | "knowledge";

interface ExportPillarData {
  id: ExportPillarId;
  title: string;
  score: number;
  scoreLabel: string;
  status: string;
  insight: string;
}

interface ExportRecommendation {
  title: string;
  body: string;
}

interface ExportReportData {
  title: string;
  description: string;
  sparkIndex: string;
  riskLevel: string;
  bandDetail: string;
  interpretation: string;
  strengthLabel: string;
  focusLabel: string;
  summaryParagraphs: string[];
  businessImplications: string[];
  recommendations: ExportRecommendation[];
  deeperAnalysisTitle: string;
  deeperAnalysisBody: string;
  pillars: ExportPillarData[];
}

const svgNs = "http://www.w3.org/2000/svg";
const exportPillarOrder: ExportPillarId[] = [
  "social",
  "purpose",
  "achievement",
  "risk",
  "knowledge",
];

const createElement = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
) => {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text) {
    element.textContent = text;
  }

  return element;
};

const createSvgNode = (tag: string, attributes: Record<string, string>) => {
  const element = document.createElementNS(svgNs, tag);

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
};

const getText = (root: ParentNode, selector: string, fallback = "") => {
  return root.querySelector<HTMLElement>(selector)?.textContent?.trim() ?? fallback;
};

const getTextList = (root: ParentNode, selector: string) => {
  return Array.from(root.querySelectorAll<HTMLElement>(selector))
    .map((item) => item.textContent?.trim() ?? "")
    .filter(Boolean);
};

const parsePercentage = (value: string) => {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

const preparePdfClone = (reportClone: HTMLElement) => {
  reportClone.querySelectorAll<HTMLElement>("[data-export-hidden]").forEach((element) => {
    element.remove();
  });

  reportClone.querySelectorAll<HTMLElement>(".assessment-report-header-actions").forEach((element) => {
    element.remove();
  });

  reportClone.querySelectorAll<HTMLElement>(".assessment-next-step").forEach((element) => {
    element.remove();
  });
};

const extractReportData = (reportNode: HTMLElement): ExportReportData => {
  const pillars = exportPillarOrder.map((id) => {
    const card = reportNode.querySelector<HTMLElement>(`[data-pillar-result="${id}"]`);

    if (!card) {
      throw new Error(`The ${id} pillar could not be prepared for export.`);
    }

    const title = getText(card, ".assessment-pillar-title", id);
    const scoreLabel = getText(card, "[data-pillar-value]", "0%");

    return {
      id,
      title,
      score: parsePercentage(scoreLabel),
      scoreLabel,
      status: getText(card, "[data-pillar-status]", "Stable"),
      insight: getText(card, "[data-pillar-copy]", ""),
    };
  });

  const recommendations = Array.from(
    reportNode.querySelectorAll<HTMLElement>(".assessment-recommendations-list li"),
  ).map((item) => ({
    title: getText(item, ".assessment-recommendation-title", "Recommendation"),
    body: getText(item, "p.body.small", ""),
  }));

  return {
    title: getText(reportNode, ".assessment-report-header h2", "SPARK Assessment Results"),
    description: getText(
      reportNode,
      ".assessment-report-description",
      "A concise view of current workforce conditions across the five SPARK pillars.",
    ),
    sparkIndex: getText(reportNode, "[data-spark-index]", "0"),
    riskLevel: getText(reportNode, "[data-risk-level]", "Stable"),
    bandDetail: getText(reportNode, "[data-band-detail]", ""),
    interpretation: getText(reportNode, "[data-score-interpretation]", ""),
    strengthLabel: getText(reportNode, "[data-strength-count]", ""),
    focusLabel: getText(reportNode, "[data-focus-count]", ""),
    summaryParagraphs: getTextList(reportNode, "[data-summary-paragraphs] p"),
    businessImplications: getTextList(reportNode, "[data-business-implications-list] li"),
    recommendations,
    deeperAnalysisTitle: getText(reportNode, "[data-deeper-analysis-title]", "Suggested deeper analysis"),
    deeperAnalysisBody: getText(reportNode, "[data-deeper-analysis-body]", ""),
    pillars,
  };
};

const createPdfSectionHeading = (label: string, title: string, description?: string) => {
  const heading = createElement("div", "assessment-pdf-section-heading");
  heading.append(
    createElement("p", "assessment-pdf-label", label),
    createElement("h2", "assessment-pdf-section-title", title),
  );

  if (description) {
    heading.append(createElement("p", "assessment-pdf-section-description", description));
  }

  return heading;
};

const buildExportRadar = (pillars: ExportPillarData[]) => {
  const wrapper = createElement("div", "assessment-pdf-radar");
  const svg = createSvgNode("svg", {
    viewBox: "0 0 320 280",
    class: "assessment-pdf-radar-svg",
    role: "img",
    "aria-label": "SPARK radar summary chart",
  });

  const centerX = 160;
  const centerY = 132;
  const outerRadius = 84;
  const labelRadius = 106;
  const angles = pillars.map((_, index) => -Math.PI / 2 + (Math.PI * 2 * index) / pillars.length);

  [25, 50, 75, 100].forEach((ring) => {
    const ringRadius = (outerRadius * ring) / 100;
    const polygonPoints = angles
      .map((angle) => {
        const x = centerX + Math.cos(angle) * ringRadius;
        const y = centerY + Math.sin(angle) * ringRadius;
        return `${x},${y}`;
      })
      .join(" ");

    svg.appendChild(
      createSvgNode("polygon", {
        points: polygonPoints,
        fill: "none",
        stroke: ring === 100 ? "rgba(95, 107, 118, 0.18)" : "rgba(95, 107, 118, 0.12)",
        "stroke-width": "1",
      }),
    );
  });

  angles.forEach((angle, index) => {
    const axisX = centerX + Math.cos(angle) * outerRadius;
    const axisY = centerY + Math.sin(angle) * outerRadius;

    svg.appendChild(
      createSvgNode("line", {
        x1: `${centerX}`,
        y1: `${centerY}`,
        x2: `${axisX}`,
        y2: `${axisY}`,
        stroke: "rgba(95, 107, 118, 0.12)",
        "stroke-width": "1",
      }),
    );

    const labelX = centerX + Math.cos(angle) * labelRadius;
    const labelY = centerY + Math.sin(angle) * labelRadius;
    const label = createSvgNode("text", {
      x: `${labelX}`,
      y: `${labelY}`,
      fill: "#5F6B76",
      "font-family": "Poppins, system-ui, sans-serif",
      "font-size": "10",
      "font-weight": "500",
      "letter-spacing": "0.02em",
      "text-anchor":
        index === 0 ? "middle" : index === 1 || index === 2 ? "start" : "end",
      "dominant-baseline": "middle",
    });
    label.textContent = pillars[index].title;
    svg.appendChild(label);
  });

  const dataPoints = angles.map((angle, index) => {
    const radius = (outerRadius * pillars[index].score) / 100;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    return { x, y, id: pillars[index].id };
  });

  svg.appendChild(
    createSvgNode("polygon", {
      points: dataPoints.map((point) => `${point.x},${point.y}`).join(" "),
      fill: "rgba(47, 111, 94, 0.08)",
      stroke: "#2F6F5E",
      "stroke-width": "1.6",
    }),
  );

  dataPoints.forEach((point) => {
    svg.appendChild(
      createSvgNode("circle", {
        cx: `${point.x}`,
        cy: `${point.y}`,
        r: "3.2",
        fill: `var(--spark-${point.id})`,
      }),
    );
  });

  wrapper.append(svg);
  return wrapper;
};

const buildOverviewPage = (data: ExportReportData) => {
  const page = createElement("section", "assessment-pdf-page assessment-pdf-page--overview");
  const header = createElement("header", "assessment-pdf-header");
  header.append(
    createElement("p", "assessment-pdf-kicker", "SPARK Assessment Results"),
    createElement("h1", "assessment-pdf-title", data.title),
    createElement("p", "assessment-pdf-description", data.description),
  );

  const overviewGrid = createElement("div", "assessment-pdf-overview-grid");

  const radarCard = createElement("section", "assessment-pdf-card");
  radarCard.append(
    createPdfSectionHeading(
      "Pillar profile",
      "See the shape of the current system.",
      "A simplified radar view showing how evenly supportive conditions are distributed across all five SPARK pillars.",
    ),
    buildExportRadar(data.pillars),
  );

  const scoreCard = createElement("section", "assessment-pdf-card assessment-pdf-card--score");
  const scoreTop = createElement("div", "assessment-pdf-score-top");
  const scorePrimary = createElement("div", "assessment-pdf-score-primary");
  scorePrimary.append(
    createElement("p", "assessment-pdf-label", "SPARK Index"),
    createElement("p", "assessment-pdf-index-value", `${data.sparkIndex}%`),
    createElement("p", "assessment-pdf-index-caption", "Overall workforce condition index"),
  );
  const scoreBand = createElement("div", "assessment-pdf-risk-panel");
  scoreBand.append(
    createElement("p", "assessment-pdf-risk-title", data.riskLevel),
    createElement("p", "assessment-pdf-risk-caption", data.bandDetail),
  );
  scoreTop.append(scorePrimary, scoreBand);

  const scoreMetrics = createElement("div", "assessment-pdf-metrics");
  const strengthMetric = createElement("div", "assessment-pdf-metric");
  strengthMetric.append(
    createElement("p", "assessment-pdf-metric-value", data.strengthLabel),
    createElement("p", "assessment-pdf-metric-label", "Top-performing pillars"),
  );
  const focusMetric = createElement("div", "assessment-pdf-metric");
  focusMetric.append(
    createElement("p", "assessment-pdf-metric-value", data.focusLabel),
    createElement("p", "assessment-pdf-metric-label", "Structural attention areas"),
  );
  scoreMetrics.append(strengthMetric, focusMetric);

  scoreCard.append(
    createPdfSectionHeading("Composite score", "Executive condition snapshot"),
    scoreTop,
    createElement("p", "assessment-pdf-interpretation", data.interpretation),
    scoreMetrics,
  );

  overviewGrid.append(radarCard, scoreCard);

  const summaryCard = createElement("section", "assessment-pdf-card");
  summaryCard.append(
    createPdfSectionHeading(
      "Executive summary",
      "What the current result suggests.",
      "This summary translates the score pattern into a leadership-level view of current stability, pressure, and follow-up priorities.",
    ),
  );
  const summaryBody = createElement("div", "assessment-pdf-paragraphs");
  const summaryParagraphs = data.summaryParagraphs.length
    ? data.summaryParagraphs.slice(0, 2)
    : [data.interpretation];
  summaryParagraphs.forEach((paragraph) => {
    summaryBody.append(createElement("p", "assessment-pdf-body", paragraph));
  });
  summaryCard.append(summaryBody);

  page.append(header, overviewGrid, summaryCard);
  return page;
};

const buildDetailsPage = (data: ExportReportData) => {
  const page = createElement("section", "assessment-pdf-page assessment-pdf-page--details");
  const header = createElement("header", "assessment-pdf-header assessment-pdf-header--compact");
  header.append(
    createElement("p", "assessment-pdf-kicker", "SPARK Assessment Results"),
    createElement(
      "h1",
      "assessment-pdf-title assessment-pdf-title--compact",
      "Detailed insights and recommended next steps",
    ),
  );

  const pillarsCard = createElement("section", "assessment-pdf-card");
  pillarsCard.append(
    createPdfSectionHeading(
      "Pillar breakdown",
      "How each condition is contributing to the current result.",
    ),
  );
  const pillarsGrid = createElement("div", "assessment-pdf-pillars-grid");
  data.pillars.forEach((pillar) => {
    const pillarCard = createElement("article", "assessment-pdf-pillar-card");
    pillarCard.style.setProperty("--pillar-accent", `var(--spark-${pillar.id})`);
    pillarCard.style.setProperty("--pillar-score", `${pillar.score}%`);
    const head = createElement("div", "assessment-pdf-pillar-head");
    head.append(
      createElement("p", "assessment-pdf-pillar-title", pillar.title),
      createElement("p", "assessment-pdf-pillar-score", pillar.scoreLabel),
    );
    const meter = createElement("div", "assessment-pdf-pillar-meter");
    meter.append(createElement("span", "assessment-pdf-pillar-meter-fill"));
    pillarCard.append(
      head,
      meter,
      createElement("p", "assessment-pdf-pillar-status", pillar.status),
      createElement("p", "assessment-pdf-pillar-insight", pillar.insight),
    );
    pillarsGrid.append(pillarCard);
  });
  pillarsCard.append(pillarsGrid);

  const detailGrid = createElement("div", "assessment-pdf-detail-grid");

  const insightsCard = createElement("section", "assessment-pdf-card");
  insightsCard.append(
    createPdfSectionHeading(
      "Key insights",
      "What this result suggests at a leadership level.",
    ),
  );
  const insightsBody = createElement("div", "assessment-pdf-paragraphs");
  data.summaryParagraphs.forEach((paragraph) => {
    insightsBody.append(createElement("p", "assessment-pdf-body", paragraph));
  });
  insightsCard.append(insightsBody);

  if (data.businessImplications.length) {
    const implicationsHeading = createElement("p", "assessment-pdf-subtitle", "Business implications");
    const implicationList = createElement("ul", "assessment-pdf-list");
    data.businessImplications.forEach((item) => {
      implicationList.append(createElement("li", "assessment-pdf-list-item", item));
    });
    insightsCard.append(implicationsHeading, implicationList);
  }

  const nextStepsCard = createElement("section", "assessment-pdf-card");
  nextStepsCard.append(
    createPdfSectionHeading(
      "Recommended next steps",
      "What to examine, clarify, or redesign next.",
    ),
  );
  const recommendationList = createElement("ol", "assessment-pdf-recommendations");
  data.recommendations.forEach((item) => {
    const recommendation = createElement("li", "assessment-pdf-recommendation");
    recommendation.append(
      createElement("p", "assessment-pdf-recommendation-title", item.title),
      createElement("p", "assessment-pdf-body assessment-pdf-body--compact", item.body),
    );
    recommendationList.append(recommendation);
  });
  nextStepsCard.append(recommendationList);

  if (data.deeperAnalysisBody) {
    const deeperAnalysis = createElement("div", "assessment-pdf-callout");
    deeperAnalysis.append(
      createElement("p", "assessment-pdf-subtitle", data.deeperAnalysisTitle),
      createElement("p", "assessment-pdf-body assessment-pdf-body--compact", data.deeperAnalysisBody),
    );
    nextStepsCard.append(deeperAnalysis);
  }

  detailGrid.append(insightsCard, nextStepsCard);
  page.append(header, pillarsCard, detailGrid);
  return page;
};

const buildPdfDocument = (reportNode: HTMLElement, exportDocument: HTMLElement) => {
  const reportClone = reportNode.cloneNode(true) as HTMLElement;
  preparePdfClone(reportClone);
  const data = extractReportData(reportClone);
  exportDocument.replaceChildren(buildOverviewPage(data), buildDetailsPage(data));
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

const renderPdf = async (
  exportRoot: HTMLElement,
  exportDocument: HTMLElement,
  setStatus: (message: string) => void,
) => {
  const pages = Array.from(
    exportDocument.querySelectorAll<HTMLElement>(".assessment-pdf-page"),
  );

  if (!pages.length) {
    throw new Error("No export pages were generated.");
  }

  const { html2canvas, jsPDF } = await loadPdfModules();
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const scale = 1.15;
  const originalRootStyles = {
    position: exportRoot.style.position,
    left: exportRoot.style.left,
    top: exportRoot.style.top,
    width: exportRoot.style.width,
    zIndex: exportRoot.style.zIndex,
    opacity: exportRoot.style.opacity,
    pointerEvents: exportRoot.style.pointerEvents,
    visibility: exportRoot.style.visibility,
  };

  exportRoot.style.position = "absolute";
  exportRoot.style.left = "-10000px";
  exportRoot.style.top = "0";
  exportRoot.style.width = `${PDF_RENDER_WIDTH}px`;
  exportRoot.style.zIndex = "0";
  exportRoot.style.opacity = "1";
  exportRoot.style.pointerEvents = "none";
  exportRoot.style.visibility = "visible";
  await waitForPaint();

  try {
    for (const [index, page] of pages.entries()) {
      setStatus(`Rendering page ${index + 1} of ${pages.length}...`);
      await waitForPaint();

      const canvas = await withTimeout(
        html2canvas(page, {
          backgroundColor: "#F7F9FB",
          scale,
          logging: false,
          useCORS: true,
          imageTimeout: 5000,
          width: PDF_RENDER_WIDTH,
          height: PDF_RENDER_HEIGHT,
          windowWidth: PDF_RENDER_WIDTH,
          windowHeight: PDF_RENDER_HEIGHT,
          scrollX: 0,
          scrollY: 0,
        }),
        HTML2CANVAS_TIMEOUT_MS,
        `Rendering timed out on page ${index + 1}.`,
      );

      if (index > 0) {
        pdf.addPage();
      }

      const imageData = canvas.toDataURL("image/png", 1);
      pdf.addImage(imageData, "PNG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
    }
  } finally {
    exportRoot.style.position = originalRootStyles.position;
    exportRoot.style.left = originalRootStyles.left;
    exportRoot.style.top = originalRootStyles.top;
    exportRoot.style.width = originalRootStyles.width;
    exportRoot.style.zIndex = originalRootStyles.zIndex;
    exportRoot.style.opacity = originalRootStyles.opacity;
    exportRoot.style.pointerEvents = originalRootStyles.pointerEvents;
    exportRoot.style.visibility = originalRootStyles.visibility;
  }

  const blob = pdf.output("blob");
  setStatus("Finalizing PDF...");
  if (typeof pdf.save === "function") {
    try {
      await pdf.save("nsbs-spark-assessment-results.pdf", { returnPromise: true });
      return "downloaded";
    } catch {
      downloadBlob(blob, "nsbs-spark-assessment-results.pdf");
      return "downloaded";
    }
  }

  downloadBlob(blob, "nsbs-spark-assessment-results.pdf");
  return "downloaded";
};

export const initSparkLevel1PdfExport = ({ rootId }: InitPdfConfig) => {
  const root = document.getElementById(rootId);

  if (!root) {
    return;
  }

  const reportNode = root.querySelector<HTMLElement>("[data-assessment-report]");
  const exportRoot = root.querySelector<HTMLElement>(`#${EXPORT_ROOT_ID}`);
  const exportDocument = root.querySelector<HTMLElement>("[data-pdf-export-document]");
  const exportPdfButton = root.querySelector<HTMLButtonElement>("[data-export-pdf]");
  const exportStatus = root.querySelector<HTMLElement>("[data-export-status]");

  if (!reportNode || !exportRoot || !exportDocument || !exportPdfButton) {
    return;
  }

  let exportInFlight = false;

  const setExportState = (isBusy: boolean, message = "") => {
    exportPdfButton.disabled = isBusy;
    exportPdfButton.textContent = isBusy ? "Preparing PDF..." : "Download Results (PDF)";

    if (exportStatus) {
      exportStatus.textContent = message;
    }
  };

  exportPdfButton.addEventListener("click", async () => {
    if (exportInFlight) {
      return;
    }

    exportInFlight = true;
    setExportState(true, "Building your two-page report...");

    const originalParent = exportRoot.parentElement;
    const originalNextSibling = exportRoot.nextSibling;

    try {
      if (originalParent && exportRoot.parentElement !== document.body) {
        document.body.appendChild(exportRoot);
      }

      buildPdfDocument(reportNode, exportDocument);
      await waitForFonts();
      await waitForPaint();
      const deliveryMethod = await renderPdf(
        exportRoot,
        exportDocument,
        (message) => setExportState(true, message),
      );
      setExportState(false, deliveryMethod === "downloaded" ? "PDF downloaded." : "");
    } catch (error) {
      console.error("Unable to export SPARK assessment PDF", error);
      const errorMessage = error instanceof Error ? error.message : "Please try again.";
      setExportState(false, `PDF export could not be completed. ${errorMessage}`);
    } finally {
      exportDocument.replaceChildren();
      if (originalParent && exportRoot.parentElement === document.body) {
        if (originalNextSibling) {
          originalParent.insertBefore(exportRoot, originalNextSibling);
        } else {
          originalParent.appendChild(exportRoot);
        }
      }
      exportInFlight = false;
    }
  });
};
