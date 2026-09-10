import { CONFIG } from "./config.js?v=13";

const APP_VERSION = "13.0.0";
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

const FIELDS = {
  id: "AANSLUITPUNT_ID",
  adres: "Adres",
  ligging: "Omschrijving_locatie",
  totaal: "TOTAAL_VERMOGEN",
  stop16: "STOPCONTACT_16A",
  blauw16: "BLAUW_230V_16A",
  blauw32: "BLAUW_230V_32A",
  blauw63: "BLAUW_230V_63A",
  rood16: "ROOD_380V_16A",
  rood32: "ROOD_380V_32A",
  rood63: "ROOD_380V_63A",
  rood125: "ROOD_380V_125A",
  rood250: "ROOD_380V_250A"
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

targetLayer = await findLayerWithField(webmap, CONFIG.copyField);

if (!targetLayer) {
  throw new Error(`Geen featurelaag gevonden met veld ${CONFIG.copyField}.`);
}

objectIdField = targetLayer.objectIdField;

// Geen popups meer op de kaart.
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

// Zelf kaartklikken afhandelen: selectie gaat naar de zijbalk, niet naar een popup.
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
  await handleCopy(getAttribute(selectedFeature, FIELDS.id));
});

previousFeatureButton.addEventListener("click", () => navigateRelative(-1));
nextFeatureButton.addEventListener("click", () => navigateRelative(1));

async function findLayerWithField(map, fieldName) {
  for (const layer of map.allLayers.toArray()) {
    if (layer.type !== "feature") continue;

    try {
      await layer.load();
      const hasField = layer.fields?.some(
        (field) => field.name.toLowerCase() === fieldName.toLowerCase()
      );

      if (hasField) {
        console.info("Doellaag:", layer.title);
        return layer;
      }
    } catch (error) {
      console.warn(`Laag overslaan: ${layer.title}`, error);
    }
  }

  return null;
}

async function loadFeatureIndex() {
  const query = targetLayer.createQuery();
  query.where = "1=1";
  query.outFields = ["*"];
  query.returnGeometry = true;

  const result = await targetLayer.queryFeatures(query);

  allFeatures = result.features.sort((a, b) =>
    String(getAttribute(a, FIELDS.id) ?? "").localeCompare(
      String(getAttribute(b, FIELDS.id) ?? ""),
      "nl",
      { numeric: true, sensitivity: "base" }
    )
  );

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

  if (window.innerWidth <= 900) {
    sidePanel.classList.add("is-open");
  }
}

function renderDetails(feature) {
  const id = textValue(feature, FIELDS.id);
  const adres = textValue(feature, FIELDS.adres);
  const ligging = textValue(feature, FIELDS.ligging);
  const totaal = numberValue(feature, FIELDS.totaal);

  headerId.textContent = `ID: ${id}`;
  footerId.textContent = `ID: ${id}`;
  adresElement.textContent = adres;
  liggingElement.textContent = ligging;
  totaalElement.textContent = `${formatNumber(totaal)} A`;

  stopcontactSection.replaceChildren();
  blauwSection.replaceChildren();
  roodSection.replaceChildren();

  let hasAnyConnection = false;

  const stop16 = numberValue(feature, FIELDS.stop16);
  if (stop16 !== 0) {
    stopcontactSection.appendChild(createRow("🔌 Stopcontact 16 A", stop16));
    hasAnyConnection = true;
  }

  const blueRows = [
    ["CEE 16 A", numberValue(feature, FIELDS.blauw16)],
    ["CEE 32 A", numberValue(feature, FIELDS.blauw32)],
    ["CEE 63 A", numberValue(feature, FIELDS.blauw63)]
  ].filter(([, value]) => value !== 0);

  if (blueRows.length) {
    blauwSection.appendChild(createGroup("🔵 Blauw — 230 V", "blue"));
    for (const [label, value] of blueRows) {
      blauwSection.appendChild(createRow(label, value));
    }
    hasAnyConnection = true;
  }

  const redRows = [
    ["CEE 16 A", numberValue(feature, FIELDS.rood16)],
    ["CEE 32 A", numberValue(feature, FIELDS.rood32)],
    ["CEE 63 A", numberValue(feature, FIELDS.rood63)],
    ["CEE 125 A", numberValue(feature, FIELDS.rood125)],
    ["CEE 250 A", numberValue(feature, FIELDS.rood250)]
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

function getAttribute(feature, fieldName) {
  const attributes = feature?.attributes;
  if (!attributes) return null;

  if (Object.prototype.hasOwnProperty.call(attributes, fieldName)) {
    return attributes[fieldName];
  }

  const wanted = fieldName.toLowerCase();
  const actual = Object.keys(attributes).find(
    (name) => name.toLowerCase() === wanted
  );

  return actual ? attributes[actual] : null;
}

function textValue(feature, fieldName) {
  const value = getAttribute(feature, fieldName);
  return value == null ? "" : String(value);
}

function numberValue(feature, fieldName) {
  const raw = getAttribute(feature, fieldName);

  if (raw == null || raw === "") {
    return 0;
  }

  const value = Number(raw);
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
