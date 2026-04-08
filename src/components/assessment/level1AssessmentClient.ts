import {
  sparkLevel1Questions,
  sparkPillars,
  sparkScaleOptions,
  type SparkPillarId,
} from "../../data/sparkLevel1Questions";
import { buildAssessmentNarrative } from "../../lib/sparkNarratives";
import { getAnsweredCount, getMissingQuestionIds, scoreAssessment, toDisplayPercentage, type AssessmentAnswers } from "../../lib/sparkScoring";

interface InitConfig {
  rootId: string;
  storageKey: string;
}

interface AssessmentConfig {
  pillars: typeof sparkPillars;
  questions: typeof sparkLevel1Questions;
  scaleOptions: typeof sparkScaleOptions;
}

interface PersistedState {
  answers: AssessmentAnswers;
  submitted: boolean;
  currentQuestionIndex: number;
}

const svgNs = "http://www.w3.org/2000/svg";
const sparkPalette = ["#4C8F7A", "#3F7664", "#C9A227", "#C47A2C", "#5C7D6F"] as const;

const createSvgNode = (tag: string, attributes: Record<string, string>) => {
  const element = document.createElementNS(svgNs, tag);

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
};

const renderList = (
  target: HTMLElement | null,
  items: Array<{ title: string; body: string }>,
  emptyMessage?: string,
) => {
  if (!target) {
    return;
  }

  target.innerHTML = "";

  if (!items.length && emptyMessage) {
    const listItem = document.createElement("li");
    listItem.textContent = emptyMessage;
    target.appendChild(listItem);
    return;
  }

  items.forEach((item) => {
    const listItem = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = `${item.title}: `;
    listItem.appendChild(strong);
    listItem.append(item.body);
    target.appendChild(listItem);
  });
};

const renderTextList = (
  target: HTMLElement | null,
  items: string[],
  emptyMessage?: string,
) => {
  if (!target) {
    return;
  }

  target.innerHTML = "";

  if (!items.length && emptyMessage) {
    const listItem = document.createElement("li");
    listItem.textContent = emptyMessage;
    target.appendChild(listItem);
    return;
  }

  items.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    target.appendChild(listItem);
  });
};

const renderRecommendations = (
  target: HTMLElement | null,
  items: Array<{ title: string; body: string }>,
) => {
  if (!target) {
    return;
  }

  target.innerHTML = "";

  items.forEach((item) => {
    const listItem = document.createElement("li");
    const heading = document.createElement("p");
    heading.className = "assessment-recommendation-title";
    heading.textContent = item.title;
    const body = document.createElement("p");
    body.className = "body small";
    body.textContent = item.body;
    listItem.append(heading, body);
    target.appendChild(listItem);
  });
};

const renderParagraphs = (target: HTMLElement | null, items: string[]) => {
  if (!target) {
    return;
  }

  target.innerHTML = "";

  items.forEach((item) => {
    const paragraph = document.createElement("p");
    paragraph.className = "body";
    paragraph.textContent = item;
    target.appendChild(paragraph);
  });
};

const getFirstSentence = (text: string) => {
  const match = text.match(/.*?[.!?](?:\s|$)/);
  return match?.[0]?.trim() ?? text.trim();
};

const getCompositeRiskLevel = (sparkIndex: number) => {
  if (sparkIndex >= 85) {
    return "Thriving";
  }

  if (sparkIndex >= 70) {
    return "Stable";
  }

  if (sparkIndex >= 55) {
    return "At Risk";
  }

  return "Critical";
};

const getScoreTone = (riskLevel: ReturnType<typeof getCompositeRiskLevel>) => {
  if (riskLevel === "Thriving") {
    return "thriving";
  }

  if (riskLevel === "Stable") {
    return "stable";
  }

  if (riskLevel === "At Risk") {
    return "at-risk";
  }

  return "critical";
};

const buildSummaryParagraphs = (
  narrative: ReturnType<typeof buildAssessmentNarrative>,
  businessImplications: string[],
) => {
  const paragraphs = [
    narrative.executiveSummary,
    narrative.strengthsSummary,
    narrative.focusAreaSummary,
    narrative.patterns[0]?.implication ?? businessImplications[0],
  ].filter(Boolean);

  return paragraphs.slice(0, 4);
};

const renderRadarChart = (
  svg: SVGSVGElement | null,
  pillars: AssessmentConfig["pillars"],
  percentages: number[],
) => {
  if (!svg) {
    return;
  }

  svg.innerHTML = `
    <title id="spark-radar-title">SPARK Level 1 radar chart</title>
    <desc id="spark-radar-description">Radar chart showing Social, Purpose, Achievement, Risk, and Knowledge scores.</desc>
  `;

  const centerX = 160;
  const centerY = 160;
  const outerRadius = 101;
  const labelRadius = 124;
  const points = pillars.map((_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / pillars.length;
    return { angle };
  });

  [20, 40, 60, 80, 100].forEach((ring) => {
    const ringRadius = (outerRadius * ring) / 100;
    const polygonPoints = points
      .map(({ angle }) => {
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

  points.forEach(({ angle }, index) => {
    const lineX = centerX + Math.cos(angle) * outerRadius;
    const lineY = centerY + Math.sin(angle) * outerRadius;
    svg.appendChild(
      createSvgNode("line", {
        x1: `${centerX}`,
        y1: `${centerY}`,
        x2: `${lineX}`,
        y2: `${lineY}`,
        stroke: "rgba(95, 107, 118, 0.14)",
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
      "font-size": "9.25",
      "font-weight": "500",
      "letter-spacing": "0.02em",
      "text-anchor":
        index === 0 ? "middle" : index === 1 || index === 2 ? "start" : index === 3 || index === 4 ? "end" : "middle",
      "dominant-baseline": "middle",
    });
    label.textContent = pillars[index].title;
    svg.appendChild(label);
  });

  const dataPoints = points.map(({ angle }, index) => {
    const radius = (outerRadius * percentages[index]) / 100;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    return { x, y };
  });

  svg.appendChild(
    createSvgNode("polygon", {
      points: dataPoints.map((point) => `${point.x},${point.y}`).join(" "),
      fill: "rgba(47, 111, 94, 0.12)",
      stroke: "#2F6F5E",
      "stroke-width": "1.8",
    }),
  );

  dataPoints.forEach((point, index) => {
    svg.appendChild(
      createSvgNode("circle", {
        cx: `${point.x}`,
        cy: `${point.y}`,
        r: "3",
        fill: sparkPalette[index],
      }),
    );

    const valueLabel = createSvgNode("text", {
      x: `${point.x}`,
      y: `${point.y - 8}`,
      fill: "#5F6B76",
      "font-family": "Poppins, system-ui, sans-serif",
      "font-size": "10",
      "text-anchor": "middle",
    });
    valueLabel.textContent = `${toDisplayPercentage(percentages[index])}`;
    svg.appendChild(valueLabel);
  });
};

export const initSparkLevel1Assessment = ({ rootId, storageKey }: InitConfig) => {
  const root = document.getElementById(rootId);

  if (!root) {
    return;
  }

  const config: AssessmentConfig = {
    pillars: sparkPillars,
    questions: sparkLevel1Questions,
    scaleOptions: sparkScaleOptions,
  };
  const form = root.querySelector<HTMLFormElement>("[data-assessment-form]");
  const formSurface = root.querySelector<HTMLElement>("[data-assessment-form-surface]");
  const results = root.querySelector<HTMLElement>("[data-assessment-results]");
  const progressValue = root.querySelector<HTMLElement>("[data-progress-value]");
  const progressFill = root.querySelector<HTMLElement>("[data-progress-fill]");
  const progressBand = root.querySelector<HTMLElement>("[data-progress-band]");
  const validationMessage = root.querySelector<HTMLElement>("[data-validation-message]");
  const progressText = root.querySelector<HTMLElement>("[data-progress-text]");
  const previousQuestionButton = root.querySelector<HTMLButtonElement>("[data-previous-question]");
  const nextQuestionButton = root.querySelector<HTMLButtonElement>("[data-next-question]");
  const submitResultsButton = root.querySelector<HTMLButtonElement>("[data-submit-results]");
  const resetProgressButton = root.querySelector<HTMLButtonElement>("[data-reset-progress]");
  const cancelResetButton = root.querySelector<HTMLButtonElement>("[data-cancel-reset]");
  const scorePanel = root.querySelector<HTMLElement>(".assessment-score-panel");
  const sparkIndexValue = root.querySelector<HTMLElement>("[data-spark-index]");
  const riskLevelValue = root.querySelector<HTMLElement>("[data-risk-level]");
  const scoreInterpretation = root.querySelector<HTMLElement>("[data-score-interpretation]");
  const summaryParagraphs = root.querySelector<HTMLElement>("[data-summary-paragraphs]");
  const businessImplicationsList = root.querySelector<HTMLElement>("[data-business-implications-list]");
  const recommendationsList = root.querySelector<HTMLElement>("[data-recommendations-list]");
  const deeperAnalysisTitle = root.querySelector<HTMLElement>("[data-deeper-analysis-title]");
  const deeperAnalysisBody = root.querySelector<HTMLElement>("[data-deeper-analysis-body]");
  const radarSvg = root.querySelector<SVGSVGElement>("[data-radar-svg]");
  const bandDetail = root.querySelector<HTMLElement>("[data-band-detail]");
  const focusCount = root.querySelector<HTMLElement>("[data-focus-count]");
  const strengthCount = root.querySelector<HTMLElement>("[data-strength-count]");

  let state: PersistedState = {
    answers: {},
    submitted: false,
    currentQuestionIndex: 0,
  };

  try {
    const raw = sessionStorage.getItem(storageKey);

    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      state = {
        answers: parsed.answers ?? {},
        submitted: parsed.submitted ?? false,
        currentQuestionIndex: parsed.currentQuestionIndex ?? 0,
      };
    }
  } catch {
    state = {
      answers: {},
      submitted: false,
      currentQuestionIndex: 0,
    };
  }

  const persist = () => {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  };

  const setResetConfirmation = (isConfirming: boolean) => {
    if (!resetProgressButton) {
      return;
    }

    resetProgressButton.dataset.confirming = isConfirming ? "true" : "false";
    resetProgressButton.textContent = isConfirming ? "Confirm Clear" : "Clear Session";

    if (cancelResetButton) {
      cancelResetButton.hidden = !isConfirming;
    }
  };

  const getCurrentQuestion = () => config.questions[state.currentQuestionIndex];

  const renderStepState = () => {
    const steps = root.querySelectorAll<HTMLElement>("[data-question-step]");

    steps.forEach((step, index) => {
      const isActive = index === state.currentQuestionIndex;
      step.hidden = !isActive;
      step.setAttribute("aria-hidden", isActive ? "false" : "true");
    });

    if (previousQuestionButton) {
      previousQuestionButton.hidden = state.currentQuestionIndex === 0;
    }

    if (nextQuestionButton) {
      nextQuestionButton.hidden = state.currentQuestionIndex === config.questions.length - 1;
    }

    if (submitResultsButton) {
      submitResultsButton.hidden = state.currentQuestionIndex !== config.questions.length - 1;
    }
  };

  const setQuestionMissingState = (questionId: string, isMissing: boolean) => {
    const fieldset = root.querySelector<HTMLElement>(`[data-question-id="${questionId}"]`);

    if (!fieldset) {
      return;
    }

    fieldset.classList.toggle("is-missing", isMissing);
    fieldset.setAttribute("data-missing", isMissing ? "true" : "false");
  };

  const syncInputs = () => {
    config.questions.forEach((question) => {
      const value = state.answers[question.id];
      const input = root.querySelector<HTMLInputElement>(
        `input[name="${question.id}"][value="${value}"]`,
      );

      root
        .querySelectorAll<HTMLInputElement>(`input[name="${question.id}"]`)
        .forEach((radio) => {
          radio.checked = false;
        });

      if (input) {
        input.checked = true;
      }

      setQuestionMissingState(question.id, false);
    });
  };

  const renderProgress = () => {
    const answeredCount = getAnsweredCount(state.answers, config.questions);
    const percentage = Math.round((answeredCount / config.questions.length) * 100);
    const currentQuestion = getCurrentQuestion();
    const currentPillar = config.pillars.find((pillar) => pillar.id === currentQuestion.pillar);
    const pillarQuestionIndex = ((currentQuestion.number - 1) % 4) + 1;

    if (progressValue) {
      progressValue.textContent = `${answeredCount}/${config.questions.length}`;
    }

    if (progressText) {
      progressText.textContent = answeredCount === config.questions.length
        ? "All questions complete. Review this response or generate results."
        : `Now assessing ${currentPillar?.title ?? "current"} conditions · question ${pillarQuestionIndex} of 4 in this pillar.`;
    }

    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }

    if (progressBand) {
      progressBand.textContent = `${percentage}% complete`;
    }
  };

  const showForm = () => {
    formSurface?.removeAttribute("hidden");
    results?.setAttribute("hidden", "true");
    root.dataset.mode = "form";
    renderStepState();
  };

  const showResults = () => {
    formSurface?.setAttribute("hidden", "true");
    results?.removeAttribute("hidden");
    root.dataset.mode = "results";
  };

  const renderResults = () => {
    const scored = scoreAssessment(state.answers, config.questions, config.pillars);
    const narrative = buildAssessmentNarrative(scored, config.pillars);
    const riskLevel = getCompositeRiskLevel(scored.sparkIndex);
    const businessImplications = narrative.businessImplications.slice(0, 3);
    const recommendations = narrative.recommendations.slice(0, 3);
    const summaryBlocks = buildSummaryParagraphs(narrative, businessImplications);
    const clearStrengthCount = scored.strengths.filter((pillar) => pillar.percentage >= 70).length;

    if (sparkIndexValue) {
      sparkIndexValue.textContent = `${toDisplayPercentage(scored.sparkIndex)}`;
    }

    if (riskLevelValue) {
      riskLevelValue.textContent = riskLevel;
    }

    if (scoreInterpretation) {
      scoreInterpretation.textContent = getFirstSentence(narrative.executiveSummary);
    }

    if (summaryParagraphs) {
      renderParagraphs(summaryParagraphs, summaryBlocks);
    }

    if (bandDetail) {
      bandDetail.textContent = `Engagement band: ${scored.engagementBand}`;
    }

    if (strengthCount) {
      strengthCount.textContent = clearStrengthCount
        ? `${clearStrengthCount} strength${clearStrengthCount === 1 ? "" : "s"}`
        : "No clear strengths";
    }

    if (focusCount) {
      focusCount.textContent = scored.focusAreas.length
        ? `${scored.focusAreas.length} focus area${scored.focusAreas.length === 1 ? "" : "s"}`
        : "No pillars below 70";
    }

    renderTextList(
      businessImplicationsList,
      businessImplications,
      "The current pattern does not point to one dominant business implication beyond the need to protect consistency and monitor drift.",
    );
    renderRecommendations(recommendationsList, recommendations);

    if (deeperAnalysisTitle) {
      deeperAnalysisTitle.textContent = narrative.deeperAnalysis.title.replace(/^Suggested deeper analysis:\s*/i, "");
    }

    if (deeperAnalysisBody) {
      deeperAnalysisBody.textContent = narrative.deeperAnalysis.body;
    }

    if (scorePanel) {
      scorePanel.dataset.scoreTone = getScoreTone(riskLevel);
    }

    scored.pillarScores.forEach((pillar) => {
      const card = root.querySelector<HTMLElement>(`[data-pillar-result="${pillar.id}"]`);

      if (!card) {
        return;
      }

      const value = card.querySelector<HTMLElement>("[data-pillar-value]");
      const status = card.querySelector<HTMLElement>("[data-pillar-status]");
      const copy = card.querySelector<HTMLElement>("[data-pillar-copy]");

      if (value) {
        value.textContent = `${toDisplayPercentage(pillar.percentage)}%`;
      }

      if (status) {
        status.textContent = pillar.status;
      }

      if (copy) {
        copy.textContent = getFirstSentence(narrative.pillarNarratives[pillar.id]);
      }

      card.style.setProperty("--pillar-score", `${pillar.percentage}%`);
    });

    renderRadarChart(
      radarSvg,
      config.pillars,
      scored.pillarScores.map((pillar) => pillar.percentage),
    );

    showResults();
  };

  const clearValidation = () => {
    if (validationMessage) {
      validationMessage.textContent = "";
    }

    setResetConfirmation(false);
  };

  const validate = () => {
    const missingQuestionIds = getMissingQuestionIds(state.answers, config.questions);

    config.questions.forEach((question) => {
      setQuestionMissingState(question.id, missingQuestionIds.includes(question.id));
    });

    if (missingQuestionIds.length) {
      if (validationMessage) {
        validationMessage.textContent = `Please answer all 20 questions before generating results. ${missingQuestionIds.length} response${missingQuestionIds.length === 1 ? "" : "s"} still missing.`;
      }

      const firstMissingIndex = config.questions.findIndex((question) => question.id === missingQuestionIds[0]);
      state.currentQuestionIndex = firstMissingIndex >= 0 ? firstMissingIndex : state.currentQuestionIndex;
      renderStepState();
      renderProgress();
      const firstMissing = root.querySelector<HTMLElement>(`[data-question-id="${missingQuestionIds[0]}"]`);
      firstMissing?.scrollIntoView({ behavior: "smooth", block: "center" });
      firstMissing?.focus({ preventScroll: true });
      persist();
      return false;
    }

    clearValidation();
    return true;
  };

  form?.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;

    if (target.type !== "radio") {
      return;
    }

    state.answers[target.name] = Number(target.value);
    state.submitted = false;
    persist();
    setQuestionMissingState(target.name, false);
    clearValidation();
    renderProgress();
  });

  const syncCurrentQuestionAnswerFromDom = () => {
    const currentQuestion = getCurrentQuestion();
    const selectedInput = root.querySelector<HTMLInputElement>(
      `input[name="${currentQuestion.id}"]:checked`,
    );

    if (selectedInput) {
      state.answers[currentQuestion.id] = Number(selectedInput.value);
      persist();
      setQuestionMissingState(currentQuestion.id, false);
      return true;
    }

    return typeof state.answers[currentQuestion.id] === "number";
  };

  const validateCurrentQuestion = () => {
    const currentQuestion = getCurrentQuestion();
    const hasAnswer = syncCurrentQuestionAnswerFromDom();

    setQuestionMissingState(currentQuestion.id, !hasAnswer);

    if (!hasAnswer) {
      if (validationMessage) {
        validationMessage.textContent = "Please choose a response before moving to the next question.";
      }

      const currentFieldset = root.querySelector<HTMLElement>(`[data-question-id="${currentQuestion.id}"]`);
      currentFieldset?.focus({ preventScroll: true });
      return false;
    }

    clearValidation();
    return true;
  };

  nextQuestionButton?.addEventListener("click", () => {
    if (!validateCurrentQuestion()) {
      return;
    }

    state.currentQuestionIndex = Math.min(config.questions.length - 1, state.currentQuestionIndex + 1);
    persist();
    renderStepState();
    renderProgress();
    setResetConfirmation(false);
    formSurface?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  previousQuestionButton?.addEventListener("click", () => {
    state.currentQuestionIndex = Math.max(0, state.currentQuestionIndex - 1);
    persist();
    clearValidation();
    renderStepState();
    renderProgress();
    setResetConfirmation(false);
    formSurface?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    syncCurrentQuestionAnswerFromDom();

    if (!validateCurrentQuestion()) {
      return;
    }

    if (!validate()) {
      return;
    }

    state.submitted = true;
    persist();
    renderResults();
    results?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  resetProgressButton?.addEventListener("click", () => {
    if (resetProgressButton.dataset.confirming !== "true") {
      setResetConfirmation(true);

      if (validationMessage) {
        validationMessage.textContent = "Select Confirm Clear to erase this session, or Keep Progress to continue where you are.";
      }

      return;
    }

    state = {
      answers: {},
      submitted: false,
      currentQuestionIndex: 0,
    };
    persist();
    syncInputs();
    renderProgress();
    clearValidation();
    showForm();
    formSurface?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  cancelResetButton?.addEventListener("click", () => {
    clearValidation();
  });

  root.querySelector<HTMLElement>("[data-retake-assessment]")?.addEventListener("click", () => {
    state = {
      answers: {},
      submitted: false,
      currentQuestionIndex: 0,
    };
    persist();
    syncInputs();
    renderProgress();
    clearValidation();
    showForm();
    formSurface?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  syncInputs();
  state.currentQuestionIndex = Math.min(Math.max(state.currentQuestionIndex, 0), config.questions.length - 1);
  setResetConfirmation(false);
  renderStepState();
  renderProgress();

  if (state.submitted && getMissingQuestionIds(state.answers, config.questions).length === 0) {
    renderResults();
  } else {
    showForm();
  }
};
