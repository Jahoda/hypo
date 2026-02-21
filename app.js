const defaults = {
  purchasePrice: 7000000,
  downPayment: 1400000,
  mortgageRate: 4.9,
  mortgageYears: 30,
  purchaseCostsPct: 4,
  appreciationRate: 3,
  maintenancePct: 1.2,
  hoaMonthly: 3500,
  propertyTaxPct: 0.1,
  ownerInsuranceMonthly: 700,
  rentMonthly: 26000,
  rentGrowthRate: 3,
  renterInsuranceMonthly: 400,
  investmentReturnRate: 7,
  investmentFeeRate: 0.5,
  extraInitialInvestment: 0,
  manualMonthlyInvestment: 0,
  includePurchaseCapitalInRental: true,
  investDifference: true,
  horizonYears: 30,
  inflationRate: 2.2,
  useRealValues: false,
  showOwner: true,
  showRenter: true,
  showPropertyValue: true,
  showMortgageBalance: false,
  showRent: true,
};

const currencyFormatter = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});
const integerFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat("cs-CZ", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const decimalFormatterCache = new Map();
const mortgageIncomeRule = {
  maxInstallmentShare: 0.45,
};
const scenarioStorageKey = "bytulacka.savedScenarios.v1";
const hashPrefix = "#has=";
const hashCompactVersion = 2;
const hashFieldAliases = {
  purchasePrice: "pp",
  downPayment: "dp",
  mortgageRate: "mr",
  mortgageYears: "my",
  purchaseCostsPct: "pc",
  appreciationRate: "ar",
  maintenancePct: "mt",
  hoaMonthly: "hm",
  propertyTaxPct: "tx",
  ownerInsuranceMonthly: "oi",
  rentMonthly: "rn",
  rentGrowthRate: "rg",
  renterInsuranceMonthly: "ri",
  investmentReturnRate: "vr",
  investmentFeeRate: "vf",
  extraInitialInvestment: "ei",
  manualMonthlyInvestment: "mi",
  includePurchaseCapitalInRental: "ic",
  investDifference: "idf",
  horizonYears: "hy",
  inflationRate: "in",
  useRealValues: "rv",
  showOwner: "so",
  showRenter: "sr",
  showPropertyValue: "sp",
  showMortgageBalance: "sm",
  showRent: "sn",
};
const hashAliasToField = Object.entries(hashFieldAliases).reduce(
  (output, [fieldId, alias]) => {
    output[alias] = fieldId;
    return output;
  },
  {},
);

const form = document.getElementById("calculatorForm");
const yearlyBody = document.getElementById("yearlyBody");
const chartPanel = document.querySelector(".chart-panel");
const chartCanvas = document.getElementById("comparisonChart");
const chartTooltip = document.getElementById("chartTooltip");
const stickyMiniChart = document.getElementById("stickyMiniChart");
const stickyMiniHead = document.getElementById("stickyMiniHead");
const stickyMiniCanvas = document.getElementById("stickyMiniCanvas");
const stickyMiniToggleBtn = document.getElementById("stickyMiniToggleBtn");
const jumpToChartBtn = document.getElementById("jumpToChartBtn");
const stickyMiniResizeHandles = Array.from(
  document.querySelectorAll(".sticky-mini-resize[data-resize]"),
);
const scenarioTabs = document.getElementById("scenarioTabs");
const scenarioNameInput = document.getElementById("scenarioNameInput");
const saveScenarioBtn = document.getElementById("saveScenarioBtn");
const deleteScenarioBtn = document.getElementById("deleteScenarioBtn");
const copyScenarioLinkBtn = document.getElementById("copyScenarioLinkBtn");
const scenarioStatus = document.getElementById("scenarioStatus");
const legendToggleButtons = Array.from(
  document.querySelectorAll(".legend-item[data-toggle-target]"),
);
const investmentPresetButtons = Array.from(
  document.querySelectorAll(".preset-btn[data-investment-preset]"),
);
const appreciationPresetButtons = Array.from(
  document.querySelectorAll(".preset-btn[data-appreciation-preset]"),
);
const adaptiveTooltipHosts = Array.from(
  document.querySelectorAll(".preset-help, .form-help"),
);

const resultElements = {
  monthlyMortgage: document.getElementById("monthlyMortgageResult"),
  ownerNetWorth: document.getElementById("ownerNetWorthResult"),
  renterNetWorth: document.getElementById("renterNetWorthResult"),
  difference: document.getElementById("differenceResult"),
  propertyValue: document.getElementById("propertyValueResult"),
  mortgageBalance: document.getElementById("mortgageBalanceResult"),
  ltv: document.getElementById("ltvResult"),
  requiredIncomeMonthly: document.getElementById("requiredIncomeMonthlyResult"),
  requiredIncomeYearly: document.getElementById("requiredIncomeYearlyResult"),
  requiredIncomeNote: document.getElementById("requiredIncomeNote"),
  interestPaid: document.getElementById("interestPaidResult"),
  breakEven: document.getElementById("breakEvenResult"),
  summary: document.getElementById("summaryText"),
};

const fieldIds = Object.keys(defaults);
const moneyInputIds = [
  "purchasePrice",
  "downPayment",
  "hoaMonthly",
  "ownerInsuranceMonthly",
  "rentMonthly",
  "renterInsuranceMonthly",
  "extraInitialInvestment",
  "manualMonthlyInvestment",
];
const moneyInputIdSet = new Set(moneyInputIds);
const rangeInputs = Array.from(
  document.querySelectorAll('input[type="range"][data-sync-target]'),
);
const rangesByTarget = new Map();

rangeInputs.forEach((rangeInput) => {
  const targetId = rangeInput.dataset.syncTarget;
  if (!targetId) return;
  if (!rangesByTarget.has(targetId)) {
    rangesByTarget.set(targetId, []);
  }
  rangesByTarget.get(targetId).push(rangeInput);
});

const chartState = {
  layout: null,
  rows: [],
  datasets: [],
  hoveredGroupIndex: null,
  pointerX: null,
  pointerY: null,
};
const stepperState = {
  activeButton: null,
  pointerId: null,
  startedAtMs: 0,
  repeatTimerId: null,
};
const stickyMiniState = {
  mode: null,
  pointerId: null,
  resizeDirection: "",
  startX: 0,
  startY: 0,
  startLeft: 0,
  startTop: 0,
  startWidth: 0,
  startPanelHeight: 0,
  startHeight: 0,
  customPosition: false,
  customSize: false,
  minimized: false,
};

let lastSimulation = null;
let pendingAnimationFrame = null;
const scenarioState = {
  activeId: null,
  scenarios: [],
};

function isBooleanDefault(id) {
  return typeof defaults[id] === "boolean";
}

function sanitizeFormValues(rawValues) {
  const output = {};
  fieldIds.forEach((id) => {
    const defaultValue = defaults[id];
    const rawValue = rawValues ? rawValues[id] : undefined;
    if (isBooleanDefault(id)) {
      output[id] =
        typeof rawValue === "boolean" ? rawValue : Boolean(defaultValue);
      return;
    }
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      output[id] = defaultValue;
      return;
    }
    const parsed = parseLooseNumber(rawValue);
    output[id] = Number.isFinite(parsed) ? parsed : defaultValue;
  });
  output.purchasePrice = Math.max(0, output.purchasePrice);
  output.downPayment = clamp(
    Math.max(0, output.downPayment),
    0,
    output.purchasePrice,
  );
  return output;
}

function createScenarioId() {
  return `scenario-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeScenarioName(rawName, fallbackIndex = 1) {
  const trimmed = String(rawName ?? "").trim();
  if (trimmed) return trimmed.slice(0, 42);
  return `Scénář ${fallbackIndex}`;
}

function getActiveScenario() {
  if (!scenarioState.activeId) return null;
  return (
    scenarioState.scenarios.find((scenario) => scenario.id === scenarioState.activeId) ||
    null
  );
}

function setScenarioStatus(message) {
  if (!scenarioStatus) return;
  scenarioStatus.textContent = message;
}

function saveScenarioStateToStorage() {
  try {
    localStorage.setItem(
      scenarioStorageKey,
      JSON.stringify({
        activeId: scenarioState.activeId,
        scenarios: scenarioState.scenarios,
      }),
    );
  } catch {
    setScenarioStatus("Scénáře se nepodařilo uložit do localStorage.");
  }
}

function loadScenarioStateFromStorage() {
  try {
    const raw = localStorage.getItem(scenarioStorageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.scenarios)) return;

    scenarioState.scenarios = parsed.scenarios
      .filter((scenario) => scenario && typeof scenario === "object")
      .map((scenario, index) => ({
        id:
          typeof scenario.id === "string" && scenario.id.trim()
            ? scenario.id
            : createScenarioId(),
        name: normalizeScenarioName(scenario.name, index + 1),
        values: sanitizeFormValues(scenario.values),
      }));

    const activeCandidate =
      typeof parsed.activeId === "string" ? parsed.activeId : null;
    scenarioState.activeId = scenarioState.scenarios.some(
      (scenario) => scenario.id === activeCandidate,
    )
      ? activeCandidate
      : null;
  } catch {
    setScenarioStatus("Uložené scénáře jsou neplatné, načítám čistý stav.");
  }
}

function renderScenarioTabs() {
  if (!scenarioTabs) return;
  scenarioTabs.innerHTML = "";

  const currentButton = document.createElement("button");
  currentButton.type = "button";
  currentButton.className = `scenario-tab ${scenarioState.activeId ? "" : "active"}`;
  currentButton.dataset.scenarioId = "";
  currentButton.textContent = "Aktuální";
  scenarioTabs.appendChild(currentButton);

  scenarioState.scenarios.forEach((scenario) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `scenario-tab ${
      scenario.id === scenarioState.activeId ? "active" : ""
    }`;
    tab.dataset.scenarioId = scenario.id;
    tab.textContent = scenario.name;
    scenarioTabs.appendChild(tab);
  });

  const activeScenario = getActiveScenario();
  if (scenarioNameInput) {
    if (activeScenario) scenarioNameInput.value = activeScenario.name;
    else if (document.activeElement !== scenarioNameInput) scenarioNameInput.value = "";
  }

  if (deleteScenarioBtn) {
    deleteScenarioBtn.disabled = !activeScenario;
  }
  if (saveScenarioBtn) {
    saveScenarioBtn.textContent = activeScenario
      ? "Uložit změny scénáře"
      : "Uložit scénář";
  }
}

function applyValuesToForm(values) {
  const sanitized = sanitizeFormValues(values);
  fieldIds.forEach((id) => {
    const field = document.getElementById(id);
    if (!field) return;

    if (field.type === "checkbox") {
      field.checked = Boolean(sanitized[id]);
      return;
    }

    if (moneyInputIdSet.has(id)) {
      field.value = formatMoneyValue(sanitized[id]);
      return;
    }

    field.value = String(sanitized[id]);
  });

  applyHousingInputConstraints();
  syncAllRangesFromNumbers();
  formatAllMoneyInputs();
  syncLegendToggleButtons();
  updateInvestmentPresetButtons();
  updateAppreciationPresetButtons();
  return sanitized;
}

function syncLegendToggleButtons() {
  if (!legendToggleButtons.length) return;
  legendToggleButtons.forEach((button) => {
    const targetId = button.dataset.toggleTarget;
    if (!targetId) return;
    const toggleField = document.getElementById(targetId);
    const isActive = toggleField ? Boolean(toggleField.checked) : false;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function toggleLegendSeries(button) {
  const targetId = button.dataset.toggleTarget;
  if (!targetId) return;
  const toggleField = document.getElementById(targetId);
  if (!toggleField || toggleField.type !== "checkbox") return;

  toggleField.checked = !toggleField.checked;
  syncLegendToggleButtons();
  scheduleUpdate();
}

function updateInvestmentPresetButtons() {
  if (!investmentPresetButtons.length) return;
  const currentRate = readNumber("investmentReturnRate");
  investmentPresetButtons.forEach((button) => {
    const presetValue = parseLooseNumber(button.dataset.investmentPreset);
    const isActive = Math.abs(currentRate - presetValue) < 0.05;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function applyInvestmentPreset(button) {
  const presetValue = parseLooseNumber(button.dataset.investmentPreset);
  const returnInput = document.getElementById("investmentReturnRate");
  if (!returnInput || !Number.isFinite(presetValue)) return;
  const min = Number.parseFloat(returnInput.min);
  const max = Number.parseFloat(returnInput.max);
  const clampedValue = clamp(presetValue, min, max);

  returnInput.value = String(clampedValue);
  syncRangesForNumberInput("investmentReturnRate");
  updateInvestmentPresetButtons();
  scheduleUpdate();
}

function updateAppreciationPresetButtons() {
  if (!appreciationPresetButtons.length) return;
  const currentRate = readNumber("appreciationRate");
  appreciationPresetButtons.forEach((button) => {
    const presetValue = parseLooseNumber(button.dataset.appreciationPreset);
    const isActive = Math.abs(currentRate - presetValue) < 0.05;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function applyAppreciationPreset(button) {
  const presetValue = parseLooseNumber(button.dataset.appreciationPreset);
  const appreciationInput = document.getElementById("appreciationRate");
  if (!appreciationInput || !Number.isFinite(presetValue)) return;
  const min = Number.parseFloat(appreciationInput.min);
  const max = Number.parseFloat(appreciationInput.max);
  const clampedValue = clamp(presetValue, min, max);

  appreciationInput.value = String(clampedValue);
  syncRangesForNumberInput("appreciationRate");
  updateAppreciationPresetButtons();
  scheduleUpdate();
}

function normalizeHashNumber(value) {
  if (!Number.isFinite(value)) return 0;
  if (Number.isInteger(value)) return value;
  return Number(value.toFixed(4));
}

function encodeBase64Url(text) {
  try {
    const binary = encodeURIComponent(text).replace(
      /%([0-9A-F]{2})/g,
      (_full, hex) => String.fromCharCode(Number.parseInt(hex, 16)),
    );
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  } catch {
    return null;
  }
}

function decodeBase64Url(payload) {
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = `${base64}${"=".repeat(padLength)}`;
    const binary = atob(padded);
    const percentEncoded = Array.from(binary)
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join("");
    return decodeURIComponent(percentEncoded);
  } catch {
    return null;
  }
}

function encodeCompactHashPayload(values) {
  const sanitized = sanitizeFormValues(values);
  const delta = {};

  fieldIds.forEach((fieldId) => {
    const currentValue = sanitized[fieldId];
    const defaultValue = defaults[fieldId];
    if (isBooleanDefault(fieldId)) {
      if (Boolean(currentValue) !== Boolean(defaultValue)) {
        delta[hashFieldAliases[fieldId] || fieldId] = currentValue ? 1 : 0;
      }
      return;
    }

    const normalizedCurrent = normalizeHashNumber(Number(currentValue));
    const normalizedDefault = normalizeHashNumber(Number(defaultValue));
    if (normalizedCurrent !== normalizedDefault) {
      delta[hashFieldAliases[fieldId] || fieldId] = normalizedCurrent;
    }
  });

  const compactPayload = {
    v: hashCompactVersion,
    d: delta,
  };
  const encoded = encodeBase64Url(JSON.stringify(compactPayload));
  if (!encoded) return null;
  return encoded;
}

function decodeCompactHashPayload(rawPayload) {
  const decodedText = decodeBase64Url(rawPayload);
  if (!decodedText) return null;

  let parsed;
  try {
    parsed = JSON.parse(decodedText);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.v !== hashCompactVersion) return null;

  const delta = parsed.d && typeof parsed.d === "object" ? parsed.d : {};
  const merged = { ...defaults };
  Object.entries(delta).forEach(([aliasOrFieldId, rawValue]) => {
    const fieldId = hashAliasToField[aliasOrFieldId] || aliasOrFieldId;
    if (!Object.prototype.hasOwnProperty.call(defaults, fieldId)) return;
    if (isBooleanDefault(fieldId)) {
      merged[fieldId] = Boolean(rawValue);
      return;
    }
    merged[fieldId] = parseLooseNumber(rawValue);
  });

  return sanitizeFormValues(merged);
}

function encodeValuesForHash(values) {
  const encodedCompactPayload = encodeCompactHashPayload(values);
  if (encodedCompactPayload) {
    return `${hashPrefix}${encodedCompactPayload}`;
  }

  const fallbackEncodedPayload = encodeURIComponent(
    JSON.stringify(sanitizeFormValues(values)),
  );
  return `${hashPrefix}${fallbackEncodedPayload}`;
}

function decodeValuesFromHash(hashValue) {
  if (typeof hashValue !== "string" || !hashValue) return null;

  const rawPayload = hashValue.startsWith(hashPrefix)
    ? hashValue.slice(hashPrefix.length)
    : hashValue.startsWith("#hash=")
      ? hashValue.slice("#hash=".length)
      : null;

  if (!rawPayload) return null;

  const decodedCompact = decodeCompactHashPayload(rawPayload);
  if (decodedCompact) return decodedCompact;

  try {
    return sanitizeFormValues(JSON.parse(decodeURIComponent(rawPayload)));
  } catch {
    return null;
  }
}

function updateHashFromInputs() {
  const nextHash = encodeValuesForHash(readInputs());
  if (window.location.hash === nextHash) return;
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
}

function applyHashToFormIfPresent(hashValue = window.location.hash) {
  const values = decodeValuesFromHash(hashValue);
  if (!values) return false;

  applyValuesToForm(values);
  scenarioState.activeId = null;
  saveScenarioStateToStorage();
  renderScenarioTabs();
  setScenarioStatus("Scénář načten z URL hashe.");
  return true;
}

function parseLooseNumber(rawValue) {
  const normalized = String(rawValue ?? "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readNumber(id) {
  const element = document.getElementById(id);
  if (!element) return 0;
  return parseLooseNumber(element.value);
}

function applyHousingInputConstraints() {
  const purchaseInput = document.getElementById("purchasePrice");
  const downPaymentInput = document.getElementById("downPayment");
  const downPaymentSlider = document.getElementById("downPaymentSlider");
  if (!purchaseInput || !downPaymentInput) return;

  const purchasePrice = Math.max(0, readNumber("purchasePrice"));
  const downPayment = Math.max(0, readNumber("downPayment"));
  const clampedDownPayment = clamp(downPayment, 0, purchasePrice);

  if (clampedDownPayment !== downPayment) {
    downPaymentInput.value = formatMoneyValue(clampedDownPayment);
  }

  purchaseInput.min = "0";
  downPaymentInput.max = String(purchasePrice);
  if (downPaymentSlider) {
    downPaymentSlider.max = String(purchasePrice);
  }

  syncRangesForNumberInput("downPayment");
}

function readInputs() {
  const purchasePrice = Math.max(0, readNumber("purchasePrice"));
  const downPayment = clamp(Math.max(0, readNumber("downPayment")), 0, purchasePrice);

  return {
    purchasePrice,
    downPayment,
    mortgageRate: Math.max(0, readNumber("mortgageRate")),
    mortgageYears: Math.max(1, readNumber("mortgageYears")),
    purchaseCostsPct: Math.max(0, readNumber("purchaseCostsPct")),
    appreciationRate: readNumber("appreciationRate"),
    maintenancePct: Math.max(0, readNumber("maintenancePct")),
    hoaMonthly: Math.max(0, readNumber("hoaMonthly")),
    propertyTaxPct: Math.max(0, readNumber("propertyTaxPct")),
    ownerInsuranceMonthly: Math.max(0, readNumber("ownerInsuranceMonthly")),
    rentMonthly: Math.max(0, readNumber("rentMonthly")),
    rentGrowthRate: readNumber("rentGrowthRate"),
    renterInsuranceMonthly: Math.max(0, readNumber("renterInsuranceMonthly")),
    investmentReturnRate: readNumber("investmentReturnRate"),
    investmentFeeRate: Math.max(0, readNumber("investmentFeeRate")),
    extraInitialInvestment: Math.max(0, readNumber("extraInitialInvestment")),
    manualMonthlyInvestment: Math.max(0, readNumber("manualMonthlyInvestment")),
    includePurchaseCapitalInRental: document.getElementById(
      "includePurchaseCapitalInRental",
    ).checked,
    investDifference: document.getElementById("investDifference").checked,
    horizonYears: Math.max(1, readNumber("horizonYears")),
    inflationRate: readNumber("inflationRate"),
    useRealValues: document.getElementById("useRealValues").checked,
    showOwner: document.getElementById("showOwner").checked,
    showRenter: document.getElementById("showRenter").checked,
    showPropertyValue: document.getElementById("showPropertyValue").checked,
    showMortgageBalance: document.getElementById("showMortgageBalance").checked,
    showRent: document.getElementById("showRent").checked,
  };
}

function annuityPayment(principal, monthlyRate, months) {
  if (principal <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  const denominator = 1 - Math.pow(1 + monthlyRate, -months);
  return denominator === 0 ? 0 : (principal * monthlyRate) / denominator;
}

function annualToMonthlyRate(ratePercent) {
  const annualRate = ratePercent / 100;
  if (annualRate <= -1) return -0.999;
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

function simulate(inputs) {
  const months = Math.max(1, Math.round(inputs.horizonYears * 12));
  const mortgageMonths = Math.max(1, Math.round(inputs.mortgageYears * 12));
  const mortgagePrincipal = Math.max(0, inputs.purchasePrice - inputs.downPayment);
  const purchaseCosts = inputs.purchasePrice * (inputs.purchaseCostsPct / 100);

  const monthlyMortgageRate = inputs.mortgageRate / 100 / 12;
  const monthlyMortgagePayment = annuityPayment(
    mortgagePrincipal,
    monthlyMortgageRate,
    mortgageMonths,
  );
  const monthlyPropertyGrowth = annualToMonthlyRate(inputs.appreciationRate);
  const monthlyRentGrowth = annualToMonthlyRate(inputs.rentGrowthRate);

  // Approximation: roční výnos i poplatky přepočtené na čistou měsíční sazbu.
  const investmentNetAnnual =
    inputs.investmentReturnRate / 100 - inputs.investmentFeeRate / 100;
  const monthlyInvestmentReturn = annualToMonthlyRate(investmentNetAnnual * 100);
  const monthlyInflation = annualToMonthlyRate(inputs.inflationRate);

  let propertyValue = inputs.purchasePrice;
  let mortgageBalance = mortgagePrincipal;
  let currentRent = inputs.rentMonthly;
  const rentalStartingPortfolio =
    inputs.extraInitialInvestment +
    (inputs.includePurchaseCapitalInRental
      ? inputs.downPayment + purchaseCosts
      : 0);
  let portfolio = rentalStartingPortfolio;
  let totalInterestPaid = 0;
  let totalOwnerCost = inputs.downPayment + purchaseCosts;
  let totalRenterCost = 0;

  const series = {
    months: [0],
    ownerNominal: [propertyValue - mortgageBalance - purchaseCosts],
    renterNominal: [portfolio],
    propertyNominal: [propertyValue],
    mortgageNominal: [mortgageBalance],
    rentNominal: [currentRent],
    ownerReal: [propertyValue - mortgageBalance - purchaseCosts],
    renterReal: [portfolio],
    propertyReal: [propertyValue],
    mortgageReal: [mortgageBalance],
    rentReal: [currentRent],
  };

  const yearly = [];

  for (let month = 1; month <= months; month += 1) {
    propertyValue *= 1 + monthlyPropertyGrowth;
    if (month > 1) currentRent *= 1 + monthlyRentGrowth;

    const inMortgage = month <= mortgageMonths && mortgageBalance > 0.01;
    const interest = inMortgage ? mortgageBalance * monthlyMortgageRate : 0;
    let principalPaid = inMortgage ? monthlyMortgagePayment - interest : 0;
    principalPaid = Math.max(0, Math.min(principalPaid, mortgageBalance));
    const mortgagePayment = interest + principalPaid;
    mortgageBalance = Math.max(0, mortgageBalance - principalPaid);

    const maintenanceCost = (propertyValue * (inputs.maintenancePct / 100)) / 12;
    const propertyTaxCost = (propertyValue * (inputs.propertyTaxPct / 100)) / 12;
    const ownerMonthlyCost =
      mortgagePayment +
      maintenanceCost +
      propertyTaxCost +
      inputs.hoaMonthly +
      inputs.ownerInsuranceMonthly;

    const renterMonthlyCost = currentRent + inputs.renterInsuranceMonthly;
    const spreadInvestment = inputs.investDifference
      ? ownerMonthlyCost - renterMonthlyCost
      : 0;

    portfolio =
      portfolio * (1 + monthlyInvestmentReturn) +
      spreadInvestment +
      inputs.manualMonthlyInvestment;

    totalInterestPaid += interest;
    totalOwnerCost += ownerMonthlyCost;
    totalRenterCost += renterMonthlyCost;

    const ownerNetWorth = propertyValue - mortgageBalance - purchaseCosts;
    const renterNetWorth = portfolio;
    const discount = Math.pow(1 + monthlyInflation, month);

    series.months.push(month);
    series.ownerNominal.push(ownerNetWorth);
    series.renterNominal.push(renterNetWorth);
    series.propertyNominal.push(propertyValue);
    series.mortgageNominal.push(mortgageBalance);
    series.rentNominal.push(currentRent);
    series.ownerReal.push(ownerNetWorth / discount);
    series.renterReal.push(renterNetWorth / discount);
    series.propertyReal.push(propertyValue / discount);
    series.mortgageReal.push(mortgageBalance / discount);
    series.rentReal.push(currentRent / discount);

    if (month % 12 === 0 || month === months) {
      yearly.push({
        year: month / 12,
        ownerNominal: ownerNetWorth,
        renterNominal: renterNetWorth,
        propertyNominal: propertyValue,
        mortgageNominal: mortgageBalance,
        rentNominal: currentRent,
        ownerReal: ownerNetWorth / discount,
        renterReal: renterNetWorth / discount,
        propertyReal: propertyValue / discount,
        mortgageReal: mortgageBalance / discount,
        rentReal: currentRent / discount,
      });
    }
  }

  return {
    inputs,
    mortgagePrincipal,
    monthlyMortgagePayment,
    purchaseCosts,
    totalInterestPaid,
    totalOwnerCost,
    totalRenterCost,
    series,
    yearly,
  };
}

function formatCurrency(value) {
  return toTypographicMinus(currencyFormatter.format(value));
}

function formatSignedCurrency(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCurrency(value)}`;
}

function formatPercent(value) {
  return `${toTypographicMinus(percentFormatter.format(value))} %`;
}

function toTypographicMinus(text) {
  return String(text).replace(/-/g, "−");
}

function getDecimalFormatter(fractionDigits = 1) {
  const key = Math.max(0, Number.parseInt(fractionDigits, 10) || 0);
  if (!decimalFormatterCache.has(key)) {
    decimalFormatterCache.set(
      key,
      new Intl.NumberFormat("cs-CZ", {
        minimumFractionDigits: key,
        maximumFractionDigits: key,
      }),
    );
  }
  return decimalFormatterCache.get(key);
}

function formatDecimal(value, fractionDigits = 1) {
  return toTypographicMinus(getDecimalFormatter(fractionDigits).format(value));
}

function formatYearLabel(value) {
  return Number.isInteger(value) ? integerFormatter.format(value) : formatDecimal(value, 1);
}

function compactAmount(value) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${formatDecimal(value / 1_000_000_000, 1)} mld`;
  if (abs >= 1_000_000) return `${formatDecimal(value / 1_000_000, 1)} mil`;
  if (abs >= 1_000) return `${formatDecimal(value / 1_000, 0)} tis`;
  return formatDecimal(value, 0);
}

function formatMoneyValue(value) {
  const rounded = Math.round(Math.max(0, value));
  return integerFormatter.format(rounded);
}

function formatMoneyInputElement(input, keepCursor = false) {
  const rawValue = String(input.value ?? "");
  const cursorBefore =
    keepCursor && input.selectionStart !== null
      ? input.selectionStart
      : rawValue.length;
  const digitsBeforeCursor = rawValue
    .slice(0, cursorBefore)
    .replace(/\D/g, "").length;
  const digitsOnly = rawValue.replace(/\D/g, "");

  if (!digitsOnly) {
    input.value = "";
    return;
  }

  const numericValue = Number.parseInt(digitsOnly, 10);
  const formatted = formatMoneyValue(numericValue);
  input.value = formatted;

  if (keepCursor && document.activeElement === input) {
    let nextCursor = formatted.length;
    let seenDigits = 0;
    for (let index = 0; index < formatted.length; index += 1) {
      if (/\d/.test(formatted[index])) {
        seenDigits += 1;
      }
      if (seenDigits >= digitsBeforeCursor) {
        nextCursor = index + 1;
        break;
      }
    }
    input.setSelectionRange(nextCursor, nextCursor);
  }
}

function formatAllMoneyInputs() {
  moneyInputIds.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    formatMoneyInputElement(input);
  });
}

function pick(nominal, real, useRealValues) {
  return useRealValues ? real : nominal;
}

function findBreakEvenMonth(ownerSeries, renterSeries) {
  for (let index = 0; index < ownerSeries.length; index += 1) {
    if (ownerSeries[index] >= renterSeries[index]) return index;
  }
  return null;
}

function updateResults(simulation) {
  const {
    inputs,
    monthlyMortgagePayment,
    mortgagePrincipal,
    totalInterestPaid,
    series,
  } = simulation;
  const useReal = inputs.useRealValues;

  const ownerSeries = useReal ? series.ownerReal : series.ownerNominal;
  const renterSeries = useReal ? series.renterReal : series.renterNominal;
  const propertySeries = useReal ? series.propertyReal : series.propertyNominal;
  const mortgageSeries = useReal ? series.mortgageReal : series.mortgageNominal;

  const ownerFinal = ownerSeries[ownerSeries.length - 1];
  const renterFinal = renterSeries[renterSeries.length - 1];
  const propertyFinal = propertySeries[propertySeries.length - 1];
  const mortgageFinal = mortgageSeries[mortgageSeries.length - 1];
  const delta = ownerFinal - renterFinal;
  const initialLtv =
    inputs.purchasePrice > 0
      ? clamp((mortgagePrincipal / inputs.purchasePrice) * 100, 0, 999)
      : 0;
  const finalLtv =
    propertyFinal > 0 ? clamp((mortgageFinal / propertyFinal) * 100, 0, 999) : 0;
  const requiredIncomeMonthly =
    mortgagePrincipal > 0
      ? monthlyMortgagePayment / mortgageIncomeRule.maxInstallmentShare
      : 0;
  const requiredIncomeYearly = requiredIncomeMonthly * 12;

  const breakEvenMonth = findBreakEvenMonth(ownerSeries, renterSeries);
  const breakEvenText =
    breakEvenMonth === null
      ? "Nedosaženo"
      : `${formatDecimal(breakEvenMonth / 12, 1)} roku`;

  resultElements.monthlyMortgage.textContent = formatCurrency(
    monthlyMortgagePayment,
  );
  resultElements.ownerNetWorth.textContent = formatCurrency(ownerFinal);
  resultElements.renterNetWorth.textContent = formatCurrency(renterFinal);
  resultElements.difference.textContent = formatSignedCurrency(delta);
  resultElements.propertyValue.textContent = formatCurrency(propertyFinal);
  resultElements.mortgageBalance.textContent = formatCurrency(mortgageFinal);
  resultElements.ltv.textContent = `${formatPercent(initialLtv)} / ${formatPercent(finalLtv)}`;
  if (resultElements.requiredIncomeMonthly) {
    resultElements.requiredIncomeMonthly.textContent = formatCurrency(
      requiredIncomeMonthly,
    );
  }
  if (resultElements.requiredIncomeYearly) {
    resultElements.requiredIncomeYearly.textContent = formatCurrency(
      requiredIncomeYearly,
    );
  }
  if (resultElements.requiredIncomeNote) {
    resultElements.requiredIncomeNote.textContent =
      mortgagePrincipal > 0
        ? `Orientační výpočet: splátka max ${formatPercent(
            mortgageIncomeRule.maxInstallmentShare * 100,
          )} z čistého měsíčního příjmu domácnosti.`
        : "Hypotéka není potřeba, akontace pokrývá celou cenu bytu.";
  }
  resultElements.interestPaid.textContent = formatCurrency(totalInterestPaid);
  resultElements.breakEven.textContent = breakEvenText;

  const valueMode = useReal ? "dnešní ceny (reálně)" : "nominální ceny";
  const breakEvenDetail =
    breakEvenMonth === null
      ? "Break-even v daném horizontu nenastal."
      : `Break-even nastává přibližně za ${formatDecimal(
          breakEvenMonth / 12,
          1,
        )} roku.`;

  let summaryClass = "summary-neutral";
  let summaryTitle = "Scénář je prakticky vyrovnaný";
  let summarySubtitle =
    `Po ${inputs.horizonYears} letech je rozdíl minimální (${formatSignedCurrency(delta)}). ${breakEvenDetail}`;
  let summaryIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v2H4zm1 4h6v2H5zm8 0h6v2h-6zM4 14h16v2H4zm1 4h6v2H5zm8 0h6v2h-6z" /></svg>';

  if (delta > 0) {
    summaryClass = "summary-owner";
    summaryTitle = "Koupě má v tomto scénáři navrch";
    summarySubtitle =
      `Varianta vlastního bydlení vede o ${formatCurrency(delta)} po ${inputs.horizonYears} letech. ${breakEvenDetail}`;
    summaryIcon =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.2 12 3l9 7.2v9.3a1.5 1.5 0 0 1-1.5 1.5h-4.8v-6.6h-5.4V21H4.5A1.5 1.5 0 0 1 3 19.5z" /></svg>';
  } else if (delta < 0) {
    summaryClass = "summary-renter";
    summaryTitle = "Nájem + investice vychází lépe";
    summarySubtitle =
      `Nájemní strategie vede o ${formatCurrency(Math.abs(delta))} po ${inputs.horizonYears} letech. ${breakEvenDetail}`;
    summaryIcon =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5zm2.5 0v1.4h13V6.5zM6.2 13.8h3.2v1.7H6.2z" /></svg>';
  }

  if (resultElements.summary) {
    resultElements.summary.className = `summary-text ${summaryClass}`;
    resultElements.summary.innerHTML =
      `<div class="summary-top">` +
      `<span class="summary-icon">${summaryIcon}</span>` +
      `<span class="summary-copy">` +
      `<strong class="summary-title">${summaryTitle}</strong>` +
      `<span class="summary-subtitle">${summarySubtitle}</span>` +
      `</span>` +
      `</div>` +
      `<div class="summary-pills">` +
      `<span class="summary-pill emphasis">Rozdíl: ${formatSignedCurrency(delta)}</span>` +
      `<span class="summary-pill">Horizont: ${inputs.horizonYears} let</span>` +
      `<span class="summary-pill">Režim: ${valueMode}</span>` +
      `</div>`;
  }
}

function updateYearlyTable(simulation) {
  const { inputs, yearly } = simulation;
  const useReal = inputs.useRealValues;

  yearlyBody.innerHTML = "";

  yearly.forEach((row) => {
    const tr = document.createElement("tr");

    const cells = [
      formatYearLabel(row.year),
      formatCurrency(pick(row.ownerNominal, row.ownerReal, useReal)),
      formatCurrency(pick(row.renterNominal, row.renterReal, useReal)),
      formatCurrency(pick(row.propertyNominal, row.propertyReal, useReal)),
      formatCurrency(pick(row.mortgageNominal, row.mortgageReal, useReal)),
    ];
    const cellClassNames = [
      "",
      "col-owner",
      "col-renter",
      "col-property",
      "col-mortgage",
    ];

    cells.forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (cellClassNames[index]) {
        td.classList.add(cellClassNames[index]);
      }
      tr.appendChild(td);
    });

    yearlyBody.appendChild(tr);
  });
}

function clamp(value, min, max) {
  let output = value;
  if (Number.isFinite(min)) output = Math.max(min, output);
  if (Number.isFinite(max)) output = Math.min(max, output);
  return output;
}

function decimalPlaces(numberValue) {
  if (!Number.isFinite(numberValue)) return 0;
  const text = String(numberValue);
  if (text.includes("e-")) {
    const [, exponent] = text.split("e-");
    return Number.parseInt(exponent, 10) || 0;
  }
  if (!text.includes(".")) return 0;
  return text.split(".")[1].length;
}

function syncRangesForNumberInput(inputId) {
  const numberInput = document.getElementById(inputId);
  const ranges = rangesByTarget.get(inputId);
  if (!numberInput || !ranges) return;

  const numberValue = readNumber(inputId);
  ranges.forEach((rangeInput) => {
    const min = Number.parseFloat(rangeInput.min);
    const max = Number.parseFloat(rangeInput.max);
    const clamped = clamp(numberValue, min, max);
    rangeInput.value = String(clamped);
  });
}

function syncAllRangesFromNumbers() {
  Array.from(rangesByTarget.keys()).forEach((inputId) => {
    syncRangesForNumberInput(inputId);
  });
}

function computeStepAccelerationMultiplier(baseAmount, holdMs) {
  const absBase = Math.abs(baseAmount);
  if (holdMs < 350) return 1;
  if (holdMs < 900) return 2;
  if (holdMs < 1700) return absBase >= 10_000 ? 5 : 3;
  if (holdMs < 2600) return absBase >= 10_000 ? 10 : 5;
  return absBase >= 10_000 ? 20 : 8;
}

function computeStepRepeatDelay(holdMs) {
  if (holdMs < 900) return 120;
  if (holdMs < 1700) return 90;
  if (holdMs < 2600) return 70;
  return 55;
}

function clearStepperRepeatTimer() {
  if (stepperState.repeatTimerId !== null) {
    clearTimeout(stepperState.repeatTimerId);
    stepperState.repeatTimerId = null;
  }
}

function stopStepperHold() {
  clearStepperRepeatTimer();
  if (stepperState.activeButton) {
    stepperState.activeButton.classList.remove("is-holding");
  }
  stepperState.activeButton = null;
  stepperState.pointerId = null;
  stepperState.startedAtMs = 0;
}

function runStepperHoldTick() {
  const activeButton = stepperState.activeButton;
  if (!activeButton) return;

  const baseAmount = Number.parseFloat(activeButton.dataset.stepAmount || "0");
  const holdMs = performance.now() - stepperState.startedAtMs;
  const multiplier = computeStepAccelerationMultiplier(baseAmount, holdMs);
  applyStep(activeButton, multiplier);

  const nextDelay = computeStepRepeatDelay(holdMs);
  stepperState.repeatTimerId = window.setTimeout(runStepperHoldTick, nextDelay);
}

function startStepperHold(button, pointerId) {
  stopStepperHold();
  stepperState.activeButton = button;
  stepperState.pointerId = pointerId;
  stepperState.startedAtMs = performance.now();
  button.classList.add("is-holding");

  // Okamžitá změna při stisku.
  applyStep(button, 1);
  stepperState.repeatTimerId = window.setTimeout(runStepperHoldTick, 320);
}

function applyStep(button, multiplier = 1) {
  const targetId = button.dataset.stepTarget;
  const baseAmount = Number.parseFloat(button.dataset.stepAmount || "0");
  const amount = baseAmount * multiplier;
  const targetInput = targetId ? document.getElementById(targetId) : null;
  if (!targetInput || !Number.isFinite(amount)) return;

  const currentValue = readNumber(targetId);
  const min = Number.parseFloat(targetInput.min || targetInput.getAttribute("min"));
  const max = Number.parseFloat(targetInput.max || targetInput.getAttribute("max"));
  const step = Number.parseFloat(targetInput.step || targetInput.getAttribute("step"));
  const stepDecimals = decimalPlaces(step);

  let nextValue = currentValue + amount;
  if (Number.isFinite(step) && step > 0) {
    nextValue = Math.round(nextValue / step) * step;
    nextValue = Number(nextValue.toFixed(stepDecimals));
  }

  nextValue = clamp(nextValue, min, max);
  targetInput.value = String(nextValue);
  if (moneyInputIdSet.has(targetId)) {
    formatMoneyInputElement(targetInput);
  }

  if (targetId === "purchasePrice" || targetId === "downPayment") {
    applyHousingInputConstraints();
  }
  syncRangesForNumberInput(targetId);
  scheduleUpdate();
}

function buildChartRows(simulation) {
  const { inputs, yearly } = simulation;
  const useReal = inputs.useRealValues;

  return yearly.map((row) => ({
    year: row.year,
    yearLabel: formatYearLabel(row.year),
    owner: pick(row.ownerNominal, row.ownerReal, useReal),
    renter: pick(row.renterNominal, row.renterReal, useReal),
    property: pick(row.propertyNominal, row.propertyReal, useReal),
    mortgage: pick(row.mortgageNominal, row.mortgageReal, useReal),
    rent: pick(row.rentNominal, row.rentReal, useReal),
  }));
}

function buildChartDatasets(inputs) {
  const datasets = [];

  if (inputs.showOwner) {
    datasets.push({
      key: "owner",
      label: "Čisté jmění koupě",
      color: "#0f766e",
      lineWidth: 3,
      dashed: false,
      axis: "left",
    });
  }
  if (inputs.showRenter) {
    datasets.push({
      key: "renter",
      label: "Čisté jmění nájem + investice",
      color: "#f97316",
      lineWidth: 3,
      dashed: false,
      axis: "left",
    });
  }

  if (inputs.showPropertyValue) {
    datasets.push({
      key: "property",
      label: "Hodnota bytu",
      color: "#1d4ed8",
      lineWidth: 2,
      dashed: true,
      axis: "left",
    });
  }
  if (inputs.showMortgageBalance) {
    datasets.push({
      key: "mortgage",
      label: "Zůstatek hypotéky",
      color: "#8b5cf6",
      lineWidth: 2,
      dashed: true,
      axis: "left",
    });
  }
  if (inputs.showRent) {
    datasets.push({
      key: "rent",
      label: "Aktuální nájemné",
      color: "#b91c1c",
      lineWidth: 2.2,
      dashed: true,
      axis: "right",
    });
  }

  return datasets;
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawChart(simulation) {
  const rows = buildChartRows(simulation);
  const datasets = buildChartDatasets(simulation.inputs);

  const rect = chartCanvas.getBoundingClientRect();
  const width = Math.max(320, rect.width);
  const fallbackHeight =
    Number.parseFloat(chartCanvas.getAttribute("height") || "380") || 380;
  const height = Math.max(260, rect.height || fallbackHeight);
  const dpr = window.devicePixelRatio || 1;

  chartCanvas.width = Math.round(width * dpr);
  chartCanvas.height = Math.round(height * dpr);

  const ctx = chartCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (!rows.length || !datasets.length) {
    chartState.layout = null;
    chartState.rows = [];
    chartState.datasets = [];
    hideChartTooltip();
    return;
  }

  const leftDatasets = datasets.filter((dataset) => dataset.axis !== "right");
  const rightDatasets = datasets.filter((dataset) => dataset.axis === "right");
  const ownerVisible = datasets.some((dataset) => dataset.key === "owner");
  const renterVisible = datasets.some((dataset) => dataset.key === "renter");
  const leftValues = rows.flatMap((row) => leftDatasets.map((set) => row[set.key]));
  const safeLeftValues = leftValues.length ? leftValues : [0];
  const leftMin = Math.min(0, ...safeLeftValues);
  const leftMax = Math.max(0, ...safeLeftValues);
  const leftRange = Math.max(1, leftMax - leftMin);
  const leftPaddedMin = leftMin - leftRange * 0.1;
  const leftPaddedMax = leftMax + leftRange * 0.1;

  let rightPaddedMin = 0;
  let rightPaddedMax = 1;
  const hasRightAxis = rightDatasets.length > 0;
  if (hasRightAxis) {
    const rightValues = rows.flatMap((row) =>
      rightDatasets.map((set) => row[set.key]),
    );
    const safeRightValues = rightValues.length ? rightValues : [0];
    const rightMin = Math.min(0, ...safeRightValues);
    const rightMax = Math.max(0, ...safeRightValues);
    const rightRange = Math.max(1, rightMax - rightMin);
    rightPaddedMin = rightMin - rightRange * 0.12;
    rightPaddedMax = rightMax + rightRange * 0.12;
  }

  const margin = { top: 18, right: hasRightAxis ? 92 : 18, bottom: 42, left: 82 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const pointCount = rows.length;

  const mapX = (index) => {
    if (pointCount <= 1) return margin.left + innerWidth / 2;
    return margin.left + (index / (pointCount - 1)) * innerWidth;
  };
  const mapYLeft = (value) =>
    margin.top +
    ((leftPaddedMax - value) / (leftPaddedMax - leftPaddedMin)) * innerHeight;
  const mapYRight = (value) =>
    margin.top +
    ((rightPaddedMax - value) / (rightPaddedMax - rightPaddedMin)) * innerHeight;
  const mapYByAxis = (value, axis = "left") =>
    axis === "right" ? mapYRight(value) : mapYLeft(value);
  const zeroY = mapYLeft(0);
  const xPoints = rows.map((_, index) => mapX(index));

  const maxHoverIndex = rows.length - 1;
  if (
    chartState.hoveredGroupIndex !== null &&
    chartState.hoveredGroupIndex > maxHoverIndex
  ) {
    chartState.hoveredGroupIndex = null;
  }

  chartState.layout = {
    width,
    height,
    margin,
    pointCount,
    xPoints,
    plotLeft: margin.left,
    plotRight: width - margin.right,
    plotTop: margin.top,
    plotBottom: height - margin.bottom,
  };
  chartState.rows = rows;
  chartState.datasets = datasets;

  ctx.strokeStyle = "#d7e7e0";
  ctx.lineWidth = 1;
  ctx.font = "12px IBM Plex Sans, Segoe UI, sans-serif";
  ctx.fillStyle = "#58706a";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const yTicks = 6;
  for (let tick = 0; tick <= yTicks; tick += 1) {
    const value = leftPaddedMin + ((leftPaddedMax - leftPaddedMin) * tick) / yTicks;
    const y = mapYLeft(value);
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();
    ctx.fillText(compactAmount(value), 8, y);
  }

  if (hasRightAxis) {
    const axisX = width - margin.right;
    ctx.strokeStyle = "#c9d9d3";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(axisX, margin.top);
    ctx.lineTo(axisX, height - margin.bottom);
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.fillStyle = "#7b4c4c";
    for (let tick = 0; tick <= yTicks; tick += 1) {
      const value =
        rightPaddedMin + ((rightPaddedMax - rightPaddedMin) * tick) / yTicks;
      const y = mapYRight(value);
      ctx.fillText(compactAmount(value), width - 8, y);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#58706a";
  }

  if (pointCount > 1) {
    for (let index = 0; index < pointCount; index += 1) {
      const shouldRenderTick =
        index % Math.max(1, Math.ceil(pointCount / 10)) === 0 || index === pointCount - 1;
      if (!shouldRenderTick) continue;
      const x = xPoints[index];
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, height - margin.bottom);
      ctx.stroke();
    }
  }

  if (leftPaddedMin < 0 && leftPaddedMax > 0) {
    ctx.strokeStyle = "#95afa8";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(margin.left, zeroY);
    ctx.lineTo(width - margin.right, zeroY);
    ctx.stroke();
  }

  if (pointCount > 1 && ownerVisible && renterVisible) {
    for (let index = 1; index < pointCount; index += 1) {
      const xPrev = xPoints[index - 1];
      const xCurr = xPoints[index];
      const ownerPrev = mapYLeft(rows[index - 1].owner);
      const ownerCurr = mapYLeft(rows[index].owner);
      const renterPrev = mapYLeft(rows[index - 1].renter);
      const renterCurr = mapYLeft(rows[index].renter);
      const deltaPrev = rows[index - 1].owner - rows[index - 1].renter;
      const deltaCurr = rows[index].owner - rows[index].renter;
      const fillColor =
        (deltaPrev + deltaCurr) / 2 >= 0
          ? hexToRgba("#0f766e", 0.12)
          : hexToRgba("#f97316", 0.12);

      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(xPrev, ownerPrev);
      ctx.lineTo(xCurr, ownerCurr);
      ctx.lineTo(xCurr, renterCurr);
      ctx.lineTo(xPrev, renterPrev);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (chartState.hoveredGroupIndex !== null) {
    const hoverX = xPoints[chartState.hoveredGroupIndex];
    ctx.strokeStyle = "rgba(15, 118, 110, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hoverX, margin.top);
    ctx.lineTo(hoverX, height - margin.bottom);
    ctx.stroke();
  }

  datasets.forEach((dataset) => {
    const allowSecondaryDimming = ownerVisible && renterVisible;
    const dimmed =
      chartState.hoveredGroupIndex !== null &&
      allowSecondaryDimming &&
      !["owner", "renter"].includes(dataset.key);
    ctx.strokeStyle = hexToRgba(dataset.color, dimmed ? 0.45 : 0.95);
    ctx.lineWidth = dataset.lineWidth;
    ctx.setLineDash(dataset.dashed ? [7, 5] : []);
    ctx.beginPath();

    rows.forEach((row, index) => {
      const x = xPoints[index];
      const y = mapYByAxis(row[dataset.key], dataset.axis);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    rows.forEach((row, index) => {
      const isHovered = chartState.hoveredGroupIndex === index;
      const shouldDrawPoint =
        isHovered || pointCount <= 26 || index % Math.max(1, Math.ceil(pointCount / 16)) === 0;
      if (!shouldDrawPoint) return;
      const x = xPoints[index];
      const y = mapYByAxis(row[dataset.key], dataset.axis);
      const radius = isHovered ? 4 : dataset.dashed ? 2.1 : 2.8;
      ctx.fillStyle = hexToRgba(dataset.color, dimmed ? 0.55 : 1);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#58706a";
  const xLabelStep = Math.max(1, Math.ceil(pointCount / 10));
  for (let index = 0; index < pointCount; index += xLabelStep) {
    const x = xPoints[index];
    ctx.fillText(rows[index].yearLabel, x, height - margin.bottom + 10);
  }
  if ((pointCount - 1) % xLabelStep !== 0) {
    const lastIndex = pointCount - 1;
    ctx.fillText(rows[lastIndex].yearLabel, xPoints[lastIndex], height - margin.bottom + 10);
  }

  if (
    chartState.hoveredGroupIndex !== null &&
    Number.isFinite(chartState.pointerX) &&
    Number.isFinite(chartState.pointerY)
  ) {
    renderChartTooltip(
      chartState.hoveredGroupIndex,
      chartState.pointerX,
      chartState.pointerY,
    );
  } else {
    hideChartTooltip();
  }
}

function renderChartTooltip(groupIndex, x, y) {
  if (!chartTooltip) return;
  const row = chartState.rows[groupIndex];
  if (!row) {
    hideChartTooltip();
    return;
  }

  const delta = row.owner - row.renter;
  const winner =
    delta > 0
      ? "Koupě je v tomto roce výš."
      : delta < 0
        ? "Nájem + investice je v tomto roce výš."
        : "V tomto roce jsou obě varianty stejně.";

  const detailLines = chartState.datasets
    .map(
      (dataset) =>
        `<div class="tip-series tip-${dataset.key}">` +
        `<span class="tip-swatch" style="--swatch:${dataset.color}"></span>` +
        `<span class="tip-label" style="color:${dataset.color}">${dataset.label}</span>` +
        `<strong>${formatCurrency(row[dataset.key])}</strong>` +
        `</div>`,
    )
    .join("");

  chartTooltip.innerHTML =
    `<strong>Rok ${row.yearLabel}</strong>` +
    `${detailLines}` +
    `<div class="tip-delta">${winner} Rozdíl: ${formatSignedCurrency(delta)}</div>`;
  chartTooltip.hidden = false;

  const tipWidth = chartTooltip.offsetWidth;
  const tipHeight = chartTooltip.offsetHeight;
  const canvasWidth = chartCanvas.clientWidth;
  const canvasHeight = chartCanvas.clientHeight;
  const offset = 14;
  const edge = 8;

  let left = x + offset;
  let top = y + offset;

  if (left + tipWidth > canvasWidth - edge) {
    left = x - tipWidth - offset;
  }
  if (top + tipHeight > canvasHeight - edge) {
    top = y - tipHeight - offset;
  }

  left = clamp(left, edge, Math.max(edge, canvasWidth - tipWidth - edge));
  top = clamp(top, edge, Math.max(edge, canvasHeight - tipHeight - edge));

  chartTooltip.style.left = `${left}px`;
  chartTooltip.style.top = `${top}px`;
}

function hideChartTooltip() {
  if (!chartTooltip) return;
  chartTooltip.hidden = true;
}

function getAdaptiveTooltipElement(host) {
  if (!host) return null;
  return host.querySelector(".preset-tooltip, .form-tooltip");
}

function positionAdaptiveTooltip(tooltip) {
  if (!tooltip) return;
  const viewportMargin = 8;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  tooltip.classList.remove("is-below");
  tooltip.style.setProperty("--tip-shift-x", "0px");
  tooltip.style.setProperty("--tip-shift-y", "0px");

  let rect = tooltip.getBoundingClientRect();
  if (rect.top < viewportMargin) {
    tooltip.classList.add("is-below");
    rect = tooltip.getBoundingClientRect();
  }

  let shiftX = 0;
  const maxRight = viewportWidth - viewportMargin;
  if (rect.left < viewportMargin) {
    shiftX += viewportMargin - rect.left;
  }
  if (rect.right > maxRight) {
    shiftX -= rect.right - maxRight;
  }
  if (Math.abs(shiftX) > 0.5) {
    tooltip.style.setProperty("--tip-shift-x", `${Math.round(shiftX)}px`);
    rect = tooltip.getBoundingClientRect();
  }

  let shiftY = 0;
  const maxBottom = viewportHeight - viewportMargin;
  if (rect.top < viewportMargin) {
    shiftY += viewportMargin - rect.top;
  }
  if (rect.bottom > maxBottom) {
    shiftY -= rect.bottom - maxBottom;
  }
  if (Math.abs(shiftY) > 0.5) {
    tooltip.style.setProperty("--tip-shift-y", `${Math.round(shiftY)}px`);
  }
}

function scheduleAdaptiveTooltipPosition(host) {
  const tooltip = getAdaptiveTooltipElement(host);
  if (!tooltip) return;
  requestAnimationFrame(() => {
    positionAdaptiveTooltip(tooltip);
  });
}

function repositionActiveAdaptiveTooltips() {
  if (!adaptiveTooltipHosts.length) return;
  adaptiveTooltipHosts.forEach((host) => {
    if (!(host.matches(":hover") || host.contains(document.activeElement))) return;
    scheduleAdaptiveTooltipPosition(host);
  });
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function resetStickyMiniInlineLayout() {
  if (!stickyMiniChart || !stickyMiniCanvas) return;
  stickyMiniChart.style.left = "";
  stickyMiniChart.style.top = "";
  stickyMiniChart.style.right = "";
  stickyMiniChart.style.bottom = "";
  stickyMiniChart.style.transform = "";
  stickyMiniChart.style.width = "";
  stickyMiniCanvas.style.height = "";
}

function normalizeStickyMiniLayoutForViewport() {
  if (!stickyMiniChart || !stickyMiniCanvas) return;
  if (isMobileViewport()) {
    stickyMiniState.customPosition = false;
    stickyMiniState.customSize = false;
    resetStickyMiniInlineLayout();
    return;
  }

  if (!stickyMiniState.customPosition) {
    stickyMiniChart.style.left = "";
    stickyMiniChart.style.top = "";
    stickyMiniChart.style.right = "";
    stickyMiniChart.style.bottom = "";
    stickyMiniChart.style.transform = "";
  }
  if (!stickyMiniState.customSize) {
    stickyMiniChart.style.width = "";
    stickyMiniCanvas.style.height = "";
  }
}

function clampStickyMiniCustomPositionToViewport() {
  if (!stickyMiniChart) return;
  if (isMobileViewport()) return;
  if (!stickyMiniState.customPosition) return;

  const viewportMargin = 6;
  const rect = stickyMiniChart.getBoundingClientRect();
  const viewportW = window.innerWidth || document.documentElement.clientWidth;
  const viewportH = window.innerHeight || document.documentElement.clientHeight;
  const maxLeft = Math.max(viewportMargin, viewportW - rect.width - viewportMargin);
  const maxTop = Math.max(viewportMargin, viewportH - rect.height - viewportMargin);
  const nextLeft = clamp(rect.left, viewportMargin, maxLeft);
  const nextTop = clamp(rect.top, viewportMargin, maxTop);

  if (
    Math.abs(nextLeft - rect.left) > 0.5 ||
    Math.abs(nextTop - rect.top) > 0.5
  ) {
    stickyMiniChart.style.left = `${Math.round(nextLeft)}px`;
    stickyMiniChart.style.top = `${Math.round(nextTop)}px`;
    stickyMiniChart.style.right = "auto";
    stickyMiniChart.style.bottom = "auto";
    stickyMiniChart.style.transform = "none";
  }
}

function setStickyMiniMinimized(nextMinimized) {
  if (!stickyMiniChart) return;
  stickyMiniState.minimized = Boolean(nextMinimized);
  stickyMiniChart.classList.toggle("is-minimized", stickyMiniState.minimized);
  if (stickyMiniToggleBtn) {
    stickyMiniToggleBtn.textContent = stickyMiniState.minimized
      ? "Rozbalit"
      : "Minimalizovat";
    stickyMiniToggleBtn.setAttribute(
      "aria-pressed",
      String(stickyMiniState.minimized),
    );
  }
  if (!stickyMiniState.minimized) {
    renderStickyMiniChartFromMain();
    clampStickyMiniCustomPositionToViewport();
    requestAnimationFrame(() => {
      clampStickyMiniCustomPositionToViewport();
    });
  }
}

function beginStickyMiniInteraction(event, mode, resizeDirection = "") {
  if (!stickyMiniChart || !stickyMiniCanvas) return;
  if (isMobileViewport()) return;
  if (stickyMiniState.minimized && mode !== "drag") return;
  if (event.button !== 0) return;
  event.preventDefault();

  const panelRect = stickyMiniChart.getBoundingClientRect();
  const canvasRect = stickyMiniCanvas.getBoundingClientRect();
  stickyMiniState.mode = mode;
  stickyMiniState.resizeDirection = resizeDirection;
  stickyMiniState.pointerId = event.pointerId;
  stickyMiniState.startX = event.clientX;
  stickyMiniState.startY = event.clientY;
  stickyMiniState.startLeft = panelRect.left;
  stickyMiniState.startTop = panelRect.top;
  stickyMiniState.startWidth = panelRect.width;
  stickyMiniState.startPanelHeight = panelRect.height;
  stickyMiniState.startHeight = canvasRect.height;
}

function handleStickyMiniPointerMove(event) {
  if (!stickyMiniChart || !stickyMiniCanvas) return;
  if (stickyMiniState.pointerId === null) return;
  if (event.pointerId !== stickyMiniState.pointerId) return;

  const dx = event.clientX - stickyMiniState.startX;
  const dy = event.clientY - stickyMiniState.startY;
  const viewportW = window.innerWidth || document.documentElement.clientWidth;
  const viewportH = window.innerHeight || document.documentElement.clientHeight;

  if (stickyMiniState.mode === "drag") {
    const panelRect = stickyMiniChart.getBoundingClientRect();
    const maxLeft = Math.max(0, viewportW - panelRect.width);
    const maxTop = Math.max(0, viewportH - panelRect.height);
    const nextLeft = clamp(stickyMiniState.startLeft + dx, 0, maxLeft);
    const nextTop = clamp(stickyMiniState.startTop + dy, 0, maxTop);

    stickyMiniChart.style.left = `${nextLeft}px`;
    stickyMiniChart.style.top = `${nextTop}px`;
    stickyMiniChart.style.right = "auto";
    stickyMiniChart.style.bottom = "auto";
    stickyMiniChart.style.transform = "none";
    stickyMiniState.customPosition = true;
    return;
  }

  if (stickyMiniState.mode === "resize") {
    const direction = stickyMiniState.resizeDirection || "right";
    const minWidth = 260;
    const maxWidth = Math.max(minWidth, viewportW - 8);
    const minHeight = 84;
    const chromeHeight = Math.max(
      0,
      stickyMiniState.startPanelHeight - stickyMiniState.startHeight,
    );

    let nextWidth = stickyMiniState.startWidth;
    let nextLeft = stickyMiniState.startLeft;
    let nextCanvasHeight = stickyMiniState.startHeight;
    let nextTop = stickyMiniState.startTop;

    if (direction.includes("right")) {
      nextWidth = clamp(stickyMiniState.startWidth + dx, minWidth, maxWidth);
    }
    if (direction.includes("left")) {
      nextWidth = clamp(stickyMiniState.startWidth - dx, minWidth, maxWidth);
      nextLeft = stickyMiniState.startLeft + (stickyMiniState.startWidth - nextWidth);
    }

    if (direction.includes("top")) {
      const maxCanvasHeight = Math.max(minHeight, viewportH * 0.62 - chromeHeight);
      nextCanvasHeight = clamp(
        stickyMiniState.startHeight - dy,
        minHeight,
        maxCanvasHeight,
      );
      const nextPanelHeight = chromeHeight + nextCanvasHeight;
      const maxTop = Math.max(0, viewportH - nextPanelHeight);
      nextTop = clamp(
        stickyMiniState.startTop +
          (stickyMiniState.startPanelHeight - nextPanelHeight),
        0,
        maxTop,
      );
    } else {
      const maxTop = Math.max(0, viewportH - stickyMiniState.startPanelHeight);
      nextTop = clamp(stickyMiniState.startTop, 0, maxTop);
    }

    const maxLeft = Math.max(0, viewportW - nextWidth);
    nextLeft = clamp(nextLeft, 0, maxLeft);

    stickyMiniChart.style.left = `${Math.round(nextLeft)}px`;
    stickyMiniChart.style.top = `${Math.round(nextTop)}px`;
    stickyMiniChart.style.right = "auto";
    stickyMiniChart.style.bottom = "auto";
    stickyMiniChart.style.transform = "none";
    stickyMiniChart.style.width = `${Math.round(nextWidth)}px`;
    stickyMiniCanvas.style.height = `${Math.round(nextCanvasHeight)}px`;
    stickyMiniState.customPosition = true;
    stickyMiniState.customSize = true;
    renderStickyMiniChartFromMain();
  }
}

function endStickyMiniInteraction(event) {
  if (stickyMiniState.pointerId === null) return;
  if (event && typeof event.pointerId === "number") {
    if (event.pointerId !== stickyMiniState.pointerId) return;
  }
  stickyMiniState.mode = null;
  stickyMiniState.pointerId = null;
  stickyMiniState.resizeDirection = "";
}

function shouldShowStickyMiniChart() {
  if (!chartPanel) return false;
  const rect = chartPanel.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const visibleHeight = Math.max(
    0,
    Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0),
  );
  const visibleRatio = visibleHeight / Math.max(rect.height, 1);
  const chartIsMostlyHidden = visibleRatio < 0.58;
  const chartIsBelowTopEdge = rect.bottom > 0 && rect.top > 24;
  return chartIsBelowTopEdge && chartIsMostlyHidden;
}

function updateStickyMiniChartVisibility() {
  if (!stickyMiniChart) return;
  normalizeStickyMiniLayoutForViewport();
  const shouldShow = shouldShowStickyMiniChart() && Boolean(lastSimulation);
  stickyMiniChart.hidden = !shouldShow;
  if (shouldShow && !stickyMiniState.minimized) {
    clampStickyMiniCustomPositionToViewport();
  }
  if (!shouldShow) {
    endStickyMiniInteraction();
  }
}

function renderStickyMiniChartFromMain() {
  if (!stickyMiniCanvas) return;
  if (stickyMiniState.minimized) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = stickyMiniCanvas.getBoundingClientRect();
  const width = Math.max(220, rect.width || 320);
  const height = Math.max(96, rect.height || 132);

  stickyMiniCanvas.width = Math.round(width * dpr);
  stickyMiniCanvas.height = Math.round(height * dpr);

  const ctx = stickyMiniCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (!chartState.rows.length || !chartState.datasets.length) return;

  const rows = chartState.rows;
  const datasets = chartState.datasets;
  const leftDatasets = datasets.filter((dataset) => dataset.axis !== "right");
  const rightDatasets = datasets.filter((dataset) => dataset.axis === "right");
  const hasRightAxis = rightDatasets.length > 0;

  const buildRange = (values, includeZero = false) => {
    const safeValues = values.length ? values : [0];
    let min = Math.min(...safeValues);
    let max = Math.max(...safeValues);
    if (includeZero) {
      min = Math.min(0, min);
      max = Math.max(0, max);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { min: 0, max: 1 };
    }
    if (max - min < 1e-9) {
      const pad = Math.max(1, Math.abs(max) * 0.1);
      return { min: min - pad, max: max + pad };
    }
    const span = max - min;
    return { min: min - span * 0.12, max: max + span * 0.12 };
  };

  const leftValues = rows.flatMap((row) => leftDatasets.map((set) => row[set.key]));
  const leftRange = buildRange(leftValues, true);
  const rightValues = hasRightAxis
    ? rows.flatMap((row) => rightDatasets.map((set) => row[set.key]))
    : [];
  const rightRange = buildRange(rightValues, true);

  const margin = { top: 8, right: 8, bottom: 8, left: 8 };
  const innerWidth = Math.max(1, width - margin.left - margin.right);
  const innerHeight = Math.max(1, height - margin.top - margin.bottom);
  const pointCount = rows.length;
  const mapX = (index) => {
    if (pointCount <= 1) return margin.left + innerWidth / 2;
    return margin.left + (index / (pointCount - 1)) * innerWidth;
  };
  const mapY = (value, axis = "left") => {
    const range = axis === "right" ? rightRange : leftRange;
    return (
      margin.top + ((range.max - value) / Math.max(1e-9, range.max - range.min)) * innerHeight
    );
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(97, 131, 124, 0.22)";
  ctx.lineWidth = 1;
  const gridTicks = 3;
  for (let tick = 0; tick <= gridTicks; tick += 1) {
    const y = margin.top + (tick / gridTicks) * innerHeight;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();
  }

  if (chartState.hoveredGroupIndex !== null && pointCount > 0) {
    const hoverIndex = clamp(chartState.hoveredGroupIndex, 0, pointCount - 1);
    const hoverX = mapX(hoverIndex);
    ctx.strokeStyle = "rgba(15, 118, 110, 0.38)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hoverX, margin.top);
    ctx.lineTo(hoverX, height - margin.bottom);
    ctx.stroke();
  }

  datasets.forEach((dataset) => {
    ctx.strokeStyle = hexToRgba(dataset.color, 0.95);
    ctx.lineWidth = Math.max(1.3, dataset.lineWidth * 0.7);
    ctx.setLineDash(dataset.dashed ? [6, 4] : []);
    ctx.beginPath();

    rows.forEach((row, index) => {
      const x = mapX(index);
      const y = mapY(row[dataset.key], dataset.axis);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

function getHoveredGroupIndex(x, y) {
  const { layout } = chartState;
  if (!layout) return null;

  const inPlot =
    x >= layout.plotLeft &&
    x <= layout.plotRight &&
    y >= layout.plotTop &&
    y <= layout.plotBottom;

  if (!inPlot) return null;

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  layout.xPoints.forEach((pointX, index) => {
    const distance = Math.abs(pointX - x);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return clamp(nearestIndex, 0, layout.pointCount - 1);
}

function updateChartHoverFromEvent(event) {
  if (!lastSimulation) return;

  const rect = chartCanvas.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;

  chartState.pointerX = pointerX;
  chartState.pointerY = pointerY;

  const hoveredIndex = getHoveredGroupIndex(pointerX, pointerY);

  if (hoveredIndex !== chartState.hoveredGroupIndex) {
    chartState.hoveredGroupIndex = hoveredIndex;
    drawChart(lastSimulation);
    return;
  }

  if (hoveredIndex === null) {
    hideChartTooltip();
    return;
  }

  renderChartTooltip(hoveredIndex, pointerX, pointerY);
}

function clearChartHover() {
  chartState.hoveredGroupIndex = null;
  chartState.pointerX = null;
  chartState.pointerY = null;
  hideChartTooltip();

  if (lastSimulation) {
    drawChart(lastSimulation);
  }
}

function activateScenario(scenarioId) {
  if (!scenarioId) {
    scenarioState.activeId = null;
    renderScenarioTabs();
    saveScenarioStateToStorage();
    setScenarioStatus("Pracuješ s aktuální (neuloženou) konfigurací.");
    updateHashFromInputs();
    return;
  }

  const scenario = scenarioState.scenarios.find((item) => item.id === scenarioId);
  if (!scenario) return;

  scenarioState.activeId = scenario.id;
  applyValuesToForm(scenario.values);
  renderScenarioTabs();
  saveScenarioStateToStorage();
  setScenarioStatus(`Načten scénář "${scenario.name}".`);
  updateFromInputs();
}

function saveCurrentScenario() {
  const values = sanitizeFormValues(readInputs());
  const activeScenario = getActiveScenario();
  const scenarioName = normalizeScenarioName(
    scenarioNameInput ? scenarioNameInput.value : "",
    scenarioState.scenarios.length + 1,
  );

  if (activeScenario) {
    activeScenario.name = scenarioName;
    activeScenario.values = values;
    setScenarioStatus(`Scénář "${scenarioName}" byl aktualizován.`);
  } else {
    const createdScenario = {
      id: createScenarioId(),
      name: scenarioName,
      values,
    };
    scenarioState.scenarios.push(createdScenario);
    scenarioState.activeId = createdScenario.id;
    setScenarioStatus(`Scénář "${scenarioName}" byl uložen.`);
  }

  saveScenarioStateToStorage();
  renderScenarioTabs();
  updateHashFromInputs();
}

function deleteActiveScenario() {
  const activeScenario = getActiveScenario();
  if (!activeScenario) return;

  scenarioState.scenarios = scenarioState.scenarios.filter(
    (scenario) => scenario.id !== activeScenario.id,
  );
  scenarioState.activeId = null;
  saveScenarioStateToStorage();
  renderScenarioTabs();
  setScenarioStatus(`Scénář "${activeScenario.name}" byl smazán.`);
  updateHashFromInputs();
}

async function copyCurrentLinkWithHash() {
  updateHashFromInputs();
  const link = window.location.href;
  try {
    await navigator.clipboard.writeText(link);
    setScenarioStatus("Odkaz na aktuální konfiguraci zkopírován.");
  } catch {
    window.prompt("Zkopíruj odkaz na konfiguraci:", link);
    setScenarioStatus("Odkaz je připravený ke zkopírování.");
  }
}

function handleScenarioTabsClick(event) {
  if (!(event.target instanceof Element)) return;
  const tabButton = event.target.closest(".scenario-tab");
  if (!tabButton) return;
  activateScenario(tabButton.dataset.scenarioId || null);
}

function updateFromInputs() {
  const inputs = readInputs();
  const simulation = simulate(inputs);

  updateResults(simulation);
  updateYearlyTable(simulation);
  drawChart(simulation);
  renderStickyMiniChartFromMain();

  lastSimulation = simulation;
  updateHashFromInputs();
  updateStickyMiniChartVisibility();
}

function scheduleUpdate() {
  if (pendingAnimationFrame !== null) {
    cancelAnimationFrame(pendingAnimationFrame);
  }
  pendingAnimationFrame = requestAnimationFrame(() => {
    pendingAnimationFrame = null;
    updateFromInputs();
  });
}

function applyDefaults() {
  fieldIds.forEach((id) => {
    const field = document.getElementById(id);
    if (!field) return;
    if (field.type === "checkbox") {
      field.checked = Boolean(defaults[id]);
    } else {
      if (moneyInputIdSet.has(id)) {
        field.value = formatMoneyValue(defaults[id]);
      } else {
        field.value = String(defaults[id]);
      }
    }
  });

  applyHousingInputConstraints();
  syncAllRangesFromNumbers();
  formatAllMoneyInputs();
  syncLegendToggleButtons();
  updateInvestmentPresetButtons();
  updateAppreciationPresetButtons();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  updateFromInputs();
});

form.addEventListener("pointerdown", (event) => {
  if (!(event.target instanceof Element)) return;
  const stepButton = event.target.closest(".step-btn");
  if (!stepButton) return;
  if (event.button !== 0) return;
  event.preventDefault();
  startStepperHold(stepButton, event.pointerId);
});

form.addEventListener("pointerup", (event) => {
  if (stepperState.pointerId === null) return;
  if (event.pointerId !== stepperState.pointerId) return;
  stopStepperHold();
});

form.addEventListener("pointercancel", (event) => {
  if (stepperState.pointerId === null) return;
  if (event.pointerId !== stepperState.pointerId) return;
  stopStepperHold();
});
window.addEventListener("pointerup", (event) => {
  if (stepperState.pointerId === null) return;
  if (event.pointerId !== stepperState.pointerId) return;
  stopStepperHold();
});
window.addEventListener("pointercancel", (event) => {
  if (stepperState.pointerId === null) return;
  if (event.pointerId !== stepperState.pointerId) return;
  stopStepperHold();
});

form.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const stepButton = event.target.closest(".step-btn");
  if (!stepButton) return;
  // Klik z myši/touche řeší pointerdown hold logika.
  // detail===0 pokrývá klávesnicový "click" (Enter/Space).
  if (event.detail !== 0) return;
  applyStep(stepButton, 1);
});

form.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!moneyInputIdSet.has(target.id)) return;
  formatMoneyInputElement(target, true);
});

form.addEventListener("focusout", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!moneyInputIdSet.has(target.id)) return;
  formatMoneyInputElement(target);
});

form.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    scheduleUpdate();
    return;
  }
  if (target.id === "scenarioNameInput") return;

  if (target.type === "range" && target.dataset.syncTarget) {
    const linkedNumber = document.getElementById(target.dataset.syncTarget);
    if (linkedNumber) {
      linkedNumber.value = target.value;
      if (moneyInputIdSet.has(linkedNumber.id)) {
        formatMoneyInputElement(linkedNumber);
      }
    }
  }

  if (target.type === "number") {
    syncRangesForNumberInput(target.id);
  }

  if (moneyInputIdSet.has(target.id)) {
    formatMoneyInputElement(target, true);
  }

  if (target.id === "investmentReturnRate" || target.id === "investmentReturnRateSlider") {
    updateInvestmentPresetButtons();
  }
  if (target.id === "appreciationRate" || target.id === "appreciationRateSlider") {
    updateAppreciationPresetButtons();
  }
  if (
    target.id === "purchasePrice" ||
    target.id === "purchasePriceSlider" ||
    target.id === "downPayment" ||
    target.id === "downPaymentSlider"
  ) {
    applyHousingInputConstraints();
  }

  scheduleUpdate();
});

["showOwner", "showRenter", "showPropertyValue", "showMortgageBalance", "showRent"].forEach(
  (fieldId) => {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.addEventListener("change", () => {
      syncLegendToggleButtons();
      scheduleUpdate();
    });
  },
);

if (legendToggleButtons.length) {
  legendToggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      toggleLegendSeries(button);
    });
  });
}

if (investmentPresetButtons.length) {
  investmentPresetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyInvestmentPreset(button);
    });
  });
}

if (appreciationPresetButtons.length) {
  appreciationPresetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyAppreciationPreset(button);
    });
  });
}

if (adaptiveTooltipHosts.length) {
  adaptiveTooltipHosts.forEach((host) => {
    host.addEventListener("mouseenter", () => {
      scheduleAdaptiveTooltipPosition(host);
    });
    host.addEventListener("focusin", () => {
      scheduleAdaptiveTooltipPosition(host);
    });
  });
}

document.getElementById("resetDefaults").addEventListener("click", () => {
  scenarioState.activeId = null;
  renderScenarioTabs();
  saveScenarioStateToStorage();
  applyDefaults();
  setScenarioStatus("Načten výchozí scénář.");
  updateFromInputs();
});
if (scenarioTabs) {
  scenarioTabs.addEventListener("click", handleScenarioTabsClick);
}
if (saveScenarioBtn) {
  saveScenarioBtn.addEventListener("click", saveCurrentScenario);
}
if (deleteScenarioBtn) {
  deleteScenarioBtn.addEventListener("click", deleteActiveScenario);
}
if (copyScenarioLinkBtn) {
  copyScenarioLinkBtn.addEventListener("click", () => {
    copyCurrentLinkWithHash();
  });
}
if (stickyMiniToggleBtn) {
  stickyMiniToggleBtn.addEventListener("click", () => {
    setStickyMiniMinimized(!stickyMiniState.minimized);
  });
}
if (jumpToChartBtn && chartPanel) {
  jumpToChartBtn.addEventListener("click", () => {
    chartPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
if (stickyMiniHead) {
  stickyMiniHead.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("button")) return;
    beginStickyMiniInteraction(event, "drag");
  });
}
if (stickyMiniResizeHandles.length) {
  stickyMiniResizeHandles.forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      const direction = handle.dataset.resize || "";
      beginStickyMiniInteraction(event, "resize", direction);
    });
  });
}

chartCanvas.addEventListener("mousemove", updateChartHoverFromEvent);
chartCanvas.addEventListener("mouseleave", clearChartHover);

window.addEventListener("pointermove", handleStickyMiniPointerMove);
window.addEventListener("pointerup", endStickyMiniInteraction);
window.addEventListener("pointercancel", endStickyMiniInteraction);

window.addEventListener("resize", () => {
  if (lastSimulation) {
    drawChart(lastSimulation);
    renderStickyMiniChartFromMain();
  }
  updateStickyMiniChartVisibility();
  repositionActiveAdaptiveTooltips();
});
window.addEventListener(
  "scroll",
  () => {
    updateStickyMiniChartVisibility();
    repositionActiveAdaptiveTooltips();
  },
  { passive: true },
);
window.addEventListener("blur", stopStepperHold);
window.addEventListener("blur", endStickyMiniInteraction);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopStepperHold();
    endStickyMiniInteraction();
  }
});
window.addEventListener("hashchange", () => {
  if (applyHashToFormIfPresent(window.location.hash)) {
    updateFromInputs();
  }
});

applyDefaults();
loadScenarioStateFromStorage();
renderScenarioTabs();
if (!applyHashToFormIfPresent(window.location.hash)) {
  const activeScenario = getActiveScenario();
  if (activeScenario) {
    applyValuesToForm(activeScenario.values);
    setScenarioStatus(`Načten scénář "${activeScenario.name}" z localStorage.`);
  } else {
    setScenarioStatus("Můžeš uložit vlastní scénáře jako taby.");
  }
}
renderScenarioTabs();
updateFromInputs();
setStickyMiniMinimized(false);
updateStickyMiniChartVisibility();
