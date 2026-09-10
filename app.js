import { CONFIG } from "./config.js?v=16";

const APP_VERSION = "16.0.0";
console.info(`Stroomaansluitingen app v${APP_VERSION}`);

const $ = (id) => document.getElementById(id);

const mapElement = $("map");
const toastElement = $("toast");
const sidePanel = $("sidePanel");
const mobilePanelToggle = $("mobilePanelToggle");

const noSelection = $("noSelection");
const featureDetails = $("featureDetails");
const headerId = $("headerId");
const footerId = $("footerId");
const copyDetailId = $("copyDetailId");
const adresElement = $("adres");
const liggingElement = $("ligging");
const totaalElement = $("totaal");
const connectionsSection = $("connectionsSection");
const stopcontactSection = $("stopcontactSection");
const blauwSection = $("blauwSection");
const roodSection = $("roodSection");

const previousFeatureButton = $("previousFeature");
const nextFeatureButton = $("nextFeature");
const pagerText = $("pagerText");

let toastTimer = null;
let targetLayer = null;
let objectIdField = null;
let allFeatures = [];
let selectedFeature = null;
let selectedIndex = -1;
let layerView = null;
let highlightHandle = null;
let FIELD = null;

// Gewenste semantische velden. We lossen ze na layer.load() op naar de
// werkelijke field name. Daardoor werken kleine naam/aliasverschillen ook.
const FIELD_SPECS = {
  id: {
    exact: ["AANSLUITPUNT_ID"],
    tokens: ["aansluitpunt", "id"]
  },
  adres: {
    exact: ["Adres", "ADRES"],
    tokens: ["adres"]
  },
  ligging: {
    exact: ["Omschrijving_locatie", "OMSCHRIJVING_LOCATIE"],
    tokens: ["omschrijving", "locatie"]
  },
  totaal: {
    exact: [
      "TOTAAL_VERMOGEN",
      "TOTAAL_STROOMSTERKTE",
      "TOTALE_STROOMSTERKTE",
      "STROOMSTERKTE_TOTAAL"
    ],
    tokenAlternatives: [
      ["totaal", "vermogen"],
      ["totaal", "stroomsterkte"],
      ["totale", "stroomsterkte"],
      ["stroomsterkte", "totaal"]
    ]
  },
  stop16: {
    exact: ["STOPCONTACT_16A"],
    tokens: ["stopcontact", "16"]
  },
  blauw16: {
    exact: ["BLAUW_230V_16A"],
    tokens: ["blauw", "230", "16"]
  },
  blauw32: {
    exact: ["BLAUW_230V_32A"],
    tokens: ["blauw", "230", "32"]
  },
  blauw63: {
    exact: ["BLAUW_230V_63A"],
    tokens: ["blauw", "230", "63"]
  },
  rood16: {
    exact: ["ROOD_380V_16A"],
    tokens: ["rood", "380", "16"]
  },
  rood32: {
    exact: ["ROOD_380V_32A"],
    tokens: ["rood", "380", "32"]
  },
  rood63: {
    exact: ["ROOD_380V_63A"],
    tokens: ["rood", "380", "63"]
  },
  rood125: {
    exact: ["ROOD_380V_125A"],
    tokens: ["rood", "380", "125"]
  },
  rood250: {
    exact: ["ROOD_380V_250A"],
    tokens: ["rood", "380", "250"]
  }
};

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.classList.toggle("toast--error", isError);
  toastElement.classList.add("toast--visible");
  toastTimer = setTimeout(() => toastElement.classList.remove("toast--visible"), 2200);
}

mobilePanelToggle.addEventListener("click", () => {
  sidePanel.classList.toggle("is-open");
});

const [
  esriConfig,
  PortalItem,
  WebMap
] = await $arcgis.import([
  "@arcgis/core/config.js",
  "@arcgis/core/portal/PortalItem.js",
  "@arcgis/core/WebMap.js"
]);

esriConfig.portalUrl = "https://www.arcgis.com";

const portalItem = new PortalItem({ id: CONFIG.webmapId });
await portalItem.load();

if (portalItem.type !== "Web Map") {
  throw new Error(`Item ${CONFIG.webmapId} is geen Web Map.`);
}

const webmap = new WebMap({ portalItem });
mapElement.map = webmap;

await webmap.loadAll();
await mapElement.viewOnReady();

const view = mapElement.view;

targetLayer = await findBestArcadeLayer(webmap);

if (!targetLayer) {
  throw new Error(`Geen featurelaag gevonden met veld ${CONFIG.copyField}.`);
}

await targetLayer.load();
objectIdField = targetLayer.objectIdField;
FIELD = resolveFields(targetLayer.fields);

console.info("Opgeloste attribuutvelden:");
console.table(FIELD);

const missingImportant = [
  "totaal",
  "blauw16",
  "blauw32",
  "blauw63"
].filter((key) => !FIELD[key]);

if (missingImportant.length) {
  console.warn(
    "Belangrijke velden ontbreken nog in de gekozen laag:",
    missingImportant
  );
  console.info(
    "Werkelijke field names in de gekozen laag:",
    targetLayer.fields.map((field) => ({
      name: field.name,
      alias: field.alias,
      type: field.type
    }))
  );
}

// Geen popups op de kaart: alle details gaan uitsluitend naar de zijbalk.
for (const layer of webmap.allLayers.toArray()) {
  if ("popupEnabled" in layer) {
    layer.popupEnabled = false;
  }
}

try {
  layerView = await view.whenLayerView(targetLayer);
} catch (error) {
  console.warn("LayerView niet beschikbaar:", error);
}

await loadFeatureIndex();

view.on("click", async (event) => {
  try {
    const response = await view.hitTest(event, { include: [targetLayer] });
    const hit = response.results.find(
      (result) => result?.graphic?.layer === targetLayer
    );

    if (!hit?.graphic) {
      return;
    }

    const oid = getObjectId(hit.graphic);
    const feature = allFeatures.find(
      (candidate) => Number(getObjectId(candidate)) === Number(oid)
    ) || hit.graphic;

    selectFeature(feature);
  } catch (error) {
    console.warn("Kaartselectie mislukt:", error);
  }
});

copyDetailId.addEventListener("click", async () => {
  await handleCopy(getFieldValue(selectedFeature, "id"));
});

previousFeatureButton.addEventListener("click", () => navigateRelative(-1));
nextFeatureButton.addEventListener("click", () => navigateRelative(1));

async function findBestArcadeLayer(map) {
  // Er kunnen meerdere featurelagen met AANSLUITPUNT_ID in de WebMap zitten.
  // Daarom nemen we niet langer de "eerste" match, maar de laag die de meeste
  // velden uit de aangeleverde Arcade-expressie werkelijk bevat.
  const expectedFields = [
    "AANSLUITPUNT_ID",
    "Adres",
    "Omschrijving_locatie",
    "TOTAAL_VERMOGEN",
    "STOPCONTACT_16A",
    "BLAUW_230V_16A",
    "BLAUW_230V_32A",
    "BLAUW_230V_63A",
    "ROOD_380V_16A",
    "ROOD_380V_32A",
    "ROOD_380V_63A",
    "ROOD_380V_125A",
    "ROOD_380V_250A"
  ];

  const candidates = [];

  for (const layer of map.allLayers.toArray()) {
    if (layer.type !== "feature") continue;

    try {
      await layer.load();

      const names = new Set(
        (layer.fields || []).map((field) => field.name.toLowerCase())
      );

      if (!names.has(CONFIG.copyField.toLowerCase())) {
        continue;
      }

      const matches = expectedFields.filter((name) =>
        names.has(name.toLowerCase())
      );

      // ID is verplicht; TOTAAL + blauwe/rode velden wegen extra zwaar.
      let score = matches.length;

      if (names.has("totaal_vermogen")) score += 5;
      if (names.has("blauw_230v_16a")) score += 4;
      if (names.has("blauw_230v_32a")) score += 4;
      if (names.has("blauw_230v_63a")) score += 4;
      if (names.has("rood_380v_16a")) score += 2;
      if (names.has("rood_380v_32a")) score += 2;
      if (names.has("rood_380v_63a")) score += 2;

      candidates.push({
        layer,
        score,
        matchedFields: matches
      });
    } catch (error) {
      console.warn(`Laag overslaan: ${layer.title}`, error);
    }
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);

  console.group("Kandidaatlagen voor stroomaansluitingen");
  for (const candidate of candidates) {
    console.info(candidate.layer.title, {
      score: candidate.score,
      matchedFields: candidate.matchedFields
    });
  }
  console.groupEnd();

  const best = candidates[0];

  console.info("Gekozen doellaag:", {
    title: best.layer.title,
    score: best.score,
    matchedFields: best.matchedFields,
    url: best.layer.url
  });

  return best.layer;
}

function resolveFields(fields) {
  const resolved = {};

  for (const [key, spec] of Object.entries(FIELD_SPECS)) {
    resolved[key] = resolveField(fields, spec);
  }

  return resolved;
}

function resolveField(fields, spec) {
  const exactNames = spec.exact || [];

  for (const wanted of exactNames) {
    const exact = fields.find(
      (field) => field.name.toLowerCase() === wanted.toLowerCase()
    );
    if (exact) return exact.name;
  }

  // Daarna ook exact op alias.
  for (const wanted of exactNames) {
    const exactAlias = fields.find(
      (field) => String(field.alias || "").toLowerCase() === wanted.toLowerCase()
    );
    if (exactAlias) return exactAlias.name;
  }

  const alternatives = spec.tokenAlternatives || (spec.tokens ? [spec.tokens] : []);

  for (const tokens of alternatives) {
    const match = fields.find((field) => {
      const haystack = normalizeFieldText(`${field.name} ${field.alias || ""}`);
      return tokens.every((token) =>
        haystack.includes(normalizeFieldText(token))
      );
    });

    if (match) return match.name;
  }

  return null;
}

function normalizeFieldText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

async function loadFeatureIndex() {
  const query = targetLayer.createQuery();
  query.where = "1=1";
  query.outFields = ["*"];
  query.returnGeometry = true;

  const result = await targetLayer.queryFeatures(query);

  allFeatures = result.features.sort((a, b) =>
    String(getFieldValue(a, "id") ?? "").localeCompare(
      String(getFieldValue(b, "id") ?? ""),
      "nl",
      { numeric: true, sensitivity: "base" }
    )
  );

  console.info(`${allFeatures.length} aansluitpunten geladen.`);
  syncPager();
}

function selectFeature(feature) {
  if (!feature) return;

  selectedFeature = feature;
  const oid = getObjectId(feature);

  selectedIndex = allFeatures.findIndex(
    (candidate) => Number(getObjectId(candidate)) === Number(oid)
  );

  noSelection.classList.add("is-hidden");
  featureDetails.classList.remove("is-hidden");

  renderDetails(feature);
  updateHighlight(feature);
  syncPager();

  console.info("Geselecteerde waarden:", {
    id: getFieldValue(feature, "id"),
    totaal: getFieldValue(feature, "totaal"),
    blauw16: getFieldValue(feature, "blauw16"),
    blauw32: getFieldValue(feature, "blauw32"),
    blauw63: getFieldValue(feature, "blauw63"),
    rood16: getFieldValue(feature, "rood16"),
    rood32: getFieldValue(feature, "rood32"),
    rood63: getFieldValue(feature, "rood63"),
    rood125: getFieldValue(feature, "rood125"),
    rood250: getFieldValue(feature, "rood250")
  });

  if (window.innerWidth <= 900) {
    sidePanel.classList.add("is-open");
  }
}

function renderDetails(feature) {
  const id = textFieldValue(feature, "id");
  const adres = textFieldValue(feature, "adres");
  const ligging = textFieldValue(feature, "ligging");

  const totaalRaw = getFieldValue(feature, "totaal");
  const totaal = parseNumericValue(totaalRaw);

  headerId.textContent = `ID: ${id}`;
  footerId.textContent = `ID: ${id}`;

  adresElement.textContent = adres;
  liggingElement.textContent = ligging;

  // Net zoals in de Arcade-expressie blijft deze sectie altijd zichtbaar.
  totaalElement.textContent = `${formatNumber(totaal)} A`;

  stopcontactSection.replaceChildren();
  blauwSection.replaceChildren();
  roodSection.replaceChildren();

  let hasAnyConnection = false;

  const stop16 = numericFieldValue(feature, "stop16");

  if (stop16 !== 0) {
    stopcontactSection.appendChild(
      createRow("🔌 Stopcontact 16 A", stop16)
    );
    hasAnyConnection = true;
  }

  const blueRows = [
    ["CEE 16 A", numericFieldValue(feature, "blauw16")],
    ["CEE 32 A", numericFieldValue(feature, "blauw32")],
    ["CEE 63 A", numericFieldValue(feature, "blauw63")]
  ].filter(([, value]) => value !== 0);

  if (blueRows.length) {
    blauwSection.appendChild(createGroup("🔵 Blauw — 230 V", "blue"));

    for (const [label, value] of blueRows) {
      blauwSection.appendChild(createRow(label, value));
    }

    hasAnyConnection = true;
  }

  const redRows = [
    ["CEE 16 A", numericFieldValue(feature, "rood16")],
    ["CEE 32 A", numericFieldValue(feature, "rood32")],
    ["CEE 63 A", numericFieldValue(feature, "rood63")],
    ["CEE 125 A", numericFieldValue(feature, "rood125")],
    ["CEE 250 A", numericFieldValue(feature, "rood250")]
  ].filter(([, value]) => value !== 0);

  if (redRows.length) {
    roodSection.appendChild(createGroup("🔴 Rood — 380 V", "red"));

    for (const [label, value] of redRows) {
      roodSection.appendChild(createRow(label, value));
    }

    hasAnyConnection = true;
  }

  connectionsSection.classList.toggle("is-hidden", !hasAnyConnection);
}

function createGroup(label, className) {
  const group = document.createElement("div");
  group.className = `connection-group ${className}`;
  group.textContent = label;
  return group;
}

function createRow(label, value) {
  const row = document.createElement("div");
  row.className = "connection-row";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("span");
  valueElement.className = "count";
  valueElement.textContent = formatNumber(value);

  row.append(labelElement, valueElement);
  return row;
}

async function navigateRelative(delta) {
  if (!allFeatures.length) return;

  let index = selectedIndex;
  if (index < 0) index = delta > 0 ? -1 : 0;

  const next = index + delta;
  if (next < 0 || next >= allFeatures.length) return;

  const feature = allFeatures[next];
  selectFeature(feature);

  if (feature.geometry) {
    try {
      previousFeatureButton.disabled = true;
      nextFeatureButton.disabled = true;

      await view.goTo(
        {
          target: feature.geometry,
          zoom: CONFIG.pagerZoom ?? 16.5
        },
        {
          duration: 700,
          easing: "ease-in-out"
        }
      );
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("Navigatie mislukt:", error);
      }
    } finally {
      syncPager();
    }
  }
}

function syncPager() {
  if (!allFeatures.length) {
    pagerText.textContent = "0 van 0";
    previousFeatureButton.disabled = true;
    nextFeatureButton.disabled = true;
    return;
  }

  const current = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  pagerText.textContent = `${current} van ${allFeatures.length}`;

  previousFeatureButton.disabled = selectedIndex <= 0;
  nextFeatureButton.disabled =
    selectedIndex < 0 || selectedIndex >= allFeatures.length - 1;
}

function updateHighlight(feature) {
  highlightHandle?.remove();
  highlightHandle = null;

  if (!layerView) return;

  const oid = getObjectId(feature);
  if (oid == null) return;

  try {
    highlightHandle = layerView.highlight(oid);
  } catch (error) {
    console.warn("Highlight mislukt:", error);
  }
}

function getObjectId(feature) {
  if (!feature?.attributes) return null;

  if (objectIdField && feature.attributes[objectIdField] != null) {
    return feature.attributes[objectIdField];
  }

  const key = Object.keys(feature.attributes).find(
    (name) => name.toLowerCase() === "objectid"
  );

  return key ? feature.attributes[key] : null;
}

function getFieldValue(feature, semanticKey) {
  const fieldName = FIELD?.[semanticKey];

  if (!fieldName || !feature?.attributes) {
    return null;
  }

  return feature.attributes[fieldName] ?? null;
}

function textFieldValue(feature, semanticKey) {
  const value = getFieldValue(feature, semanticKey);
  return value == null ? "" : String(value);
}

function numericFieldValue(feature, semanticKey) {
  return parseNumericValue(getFieldValue(feature, semanticKey));
}

// Robuuster dan Number(value):
//  "63"       -> 63
//  "63,0"     -> 63
//  "63 A"     -> 63
//  "1.250,5"  -> 1250.5
function parseNumericValue(raw) {
  if (raw == null || raw === "") return 0;

  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : 0;
  }

  let text = String(raw).trim();
  if (!text) return 0;

  text = text.replace(/\s+/g, "");
  text = text.replace(/[^\d,.\-+]/g, "");

  if (!text) return 0;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    // Belgische notatie: 1.250,5
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      // Engelse notatie: 1,250.5
      text = text.replace(/,/g, "");
    }
  } else if (hasComma) {
    text = text.replace(",", ".");
  }

  const value = Number(text);
  return Number.isFinite(value) ? value : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("nl-BE", {
    maximumFractionDigits: 2
  }).format(value);
}

async function handleCopy(value) {
  if (value == null || String(value).trim() === "") {
    showToast(`Veld ${CONFIG.copyField} is leeg.`, true);
    return;
  }

  try {
    await copyToClipboard(String(value));
    showToast(`✓ Gekopieerd: ${value}`);
  } catch (error) {
    console.error("Kopiëren mislukt:", error);
    showToast("Kopiëren naar het klembord is mislukt.", true);
  }
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const ok = document.execCommand("copy");
  textarea.remove();

  if (!ok) {
    throw new Error("Clipboard fallback failed");
  }
}
