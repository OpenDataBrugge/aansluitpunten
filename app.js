import { CONFIG } from "./config.js?v=6";

const APP_VERSION = "6.0.0";
console.info(`Stroomaansluitingen app v${APP_VERSION}`);

const $ = (id) => document.getElementById(id);

const mapElement = $("map");
const toastElement = $("toast");
const detailsPanel = $("detailsPanel");
const listPanel = $("listPanel");
const detailsTab = $("detailsTab");
const listTab = $("listTab");
const mobilePanelToggle = $("mobilePanelToggle");
const sidePanel = $("sidePanel");

const noSelection = $("noSelection");
const featureDetails = $("featureDetails");
const detailTitle = $("detailTitle");
const assetIdLine = $("assetIdLine");
const footerId = $("footerId");
const copyDetailId = $("copyDetailId");

const locationBlock = $("locationBlock");
const locationPrimary = $("locationPrimary");
const locationSecondary = $("locationSecondary");
const currentBlock = $("currentBlock");
const currentValue = $("currentValue");
const attributesBlock = $("attributesBlock");
const attributeRows = $("attributeRows");

const previousFeatureButton = $("previousFeature");
const nextFeatureButton = $("nextFeature");
const pagerText = $("pagerText");

const featureListElement = $("featureList");
const loadingState = $("loadingState");
const emptyState = $("emptyState");
const resultCount = $("resultCount");
const searchInput = $("featureSearch");
const clearSearchButton = $("clearSearch");

let toastTimer = null;
let targetLayer = null;
let objectIdField = null;
let allFeatures = [];
let filteredFeatures = [];
let selectedFeature = null;
let selectedObjectId = null;
let selectedIndex = -1;
let layerView = null;
let highlightHandle = null;
let fieldProfile = null;

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.classList.toggle("toast--error", isError);
  toastElement.classList.add("toast--visible");
  toastTimer = setTimeout(() => toastElement.classList.remove("toast--visible"), 2200);
}

function showPanel(name) {
  const showDetails = name === "details";
  detailsPanel.hidden = !showDetails;
  listPanel.hidden = showDetails;
  detailsTab.classList.toggle("is-active", showDetails);
  listTab.classList.toggle("is-active", !showDetails);
}

detailsTab.addEventListener("click", () => showPanel("details"));
listTab.addEventListener("click", () => showPanel("list"));
$("openListFromEmpty").addEventListener("click", () => showPanel("list"));

mobilePanelToggle.addEventListener("click", () => {
  sidePanel.classList.toggle("is-open");
});

const [
  esriConfig,
  PortalItem,
  WebMap,
  ActionButton,
  reactiveUtils
] = await $arcgis.import([
  "@arcgis/core/config.js",
  "@arcgis/core/portal/PortalItem.js",
  "@arcgis/core/WebMap.js",
  "@arcgis/core/support/actions/ActionButton.js",
  "@arcgis/core/core/reactiveUtils.js"
]);

esriConfig.portalUrl = "https://www.arcgis.com";

const portalItem = new PortalItem({ id: CONFIG.webmapId });
await portalItem.load();

if (portalItem.type !== "Web Map") {
  throw new Error(`Item ${CONFIG.webmapId} is geen Web Map.`);
}

const webmap = new WebMap({ portalItem });
mapElement.map = webmap;

try {
  await webmap.loadAll();
} catch (error) {
  console.error("WebMap laden mislukt:", error);
  showToast("WebMap kon niet worden geladen.", true);
  throw error;
}

await mapElement.viewOnReady();

const view = mapElement.view;
const popup = mapElement.popupElement;

targetLayer = await findLayerWithField(webmap, CONFIG.copyField);

if (!targetLayer) {
  loadingState.hidden = true;
  emptyState.hidden = false;
  emptyState.textContent = `Geen laag gevonden met veld "${CONFIG.copyField}".`;
  resultCount.textContent = "0 aansluitpunten";
} else {
  objectIdField = targetLayer.objectIdField;
  fieldProfile = buildFieldProfile(targetLayer.fields, CONFIG.copyField);

  try {
    layerView = await view.whenLayerView(targetLayer);
  } catch (error) {
    console.warn("LayerView niet beschikbaar:", error);
  }

  await loadFeatureList();
}

const copyAction = new ActionButton({
  id: "copy-selected-id",
  title: CONFIG.copyActionTitle,
  icon: "copy"
});

popup.actions.add(copyAction);

reactiveUtils.watch(
  () => popup.selectedFeature,
  (feature) => {
    if (!feature) return;

    const value = getAttribute(feature, CONFIG.copyField);
    copyAction.disabled = value == null || String(value).trim() === "";

    if (value != null && String(value).trim() !== "") {
      selectFeature(feature, { openDetails: true, scrollList: true });
    }
  },
  { initial: true }
);

popup.addEventListener("arcgisTriggerAction", async (event) => {
  if (event.detail.action.id !== copyAction.id) return;
  await handleCopy(getAttribute(popup.selectedFeature, CONFIG.copyField));
});

copyDetailId.addEventListener("click", async () => {
  await handleCopy(getAttribute(selectedFeature, CONFIG.copyField));
});

previousFeatureButton.addEventListener("click", () => navigateRelative(-1));
nextFeatureButton.addEventListener("click", () => navigateRelative(1));

searchInput.addEventListener("input", () => {
  const term = normalize(searchInput.value);
  clearSearchButton.hidden = term.length === 0;

  filteredFeatures = term
    ? allFeatures.filter((feature) =>
        normalize(
          Object.values(feature.attributes || {})
            .filter((v) => v !== null && v !== undefined)
            .join(" ")
        ).includes(term)
      )
    : [...allFeatures];

  renderFeatureList();
  syncPager();
});

clearSearchButton.addEventListener("click", () => {
  searchInput.value = "";
  clearSearchButton.hidden = true;
  filteredFeatures = [...allFeatures];
  renderFeatureList();
  syncPager();
  searchInput.focus();
});

async function findLayerWithField(map, fieldName) {
  for (const layer of map.allLayers.toArray()) {
    if (layer.type !== "feature") continue;

    try {
      await layer.load();
      const hasField = layer.fields?.some(
        (field) => field.name.toLowerCase() === fieldName.toLowerCase()
      );
      if (hasField) return layer;
    } catch (error) {
      console.warn(`Laag overslaan: ${layer.title}`, error);
    }
  }
  return null;
}

async function loadFeatureList() {
  loadingState.hidden = false;
  emptyState.hidden = true;

  try {
    const query = targetLayer.createQuery();
    query.where = "1=1";
    query.outFields = ["*"];
    query.returnGeometry = true;

    const result = await targetLayer.queryFeatures(query);
    allFeatures = result.features;

    allFeatures.sort((a, b) =>
      String(getAttribute(a, CONFIG.copyField) ?? "").localeCompare(
        String(getAttribute(b, CONFIG.copyField) ?? ""),
        "nl",
        { numeric: true, sensitivity: "base" }
      )
    );

    filteredFeatures = [...allFeatures];
    renderFeatureList();
    syncPager();
  } catch (error) {
    console.error("Lijst laden mislukt:", error);
    emptyState.hidden = false;
    emptyState.textContent = "De lijst met aansluitpunten kon niet worden geladen.";
    resultCount.textContent = "Laden mislukt";
  } finally {
    loadingState.hidden = true;
  }
}

function renderFeatureList() {
  featureListElement.replaceChildren();

  resultCount.textContent = `${filteredFeatures.length} ${
    filteredFeatures.length === 1 ? "aansluitpunt" : "aansluitpunten"
  }`;

  emptyState.hidden = filteredFeatures.length !== 0;

  const fragment = document.createDocumentFragment();

  for (const feature of filteredFeatures) {
    const item = document.createElement("article");
    item.className = "feature-item";
    item.setAttribute("role", "listitem");

    const oid = getObjectId(feature);
    if (selectedObjectId != null && Number(oid) === Number(selectedObjectId)) {
      item.classList.add("is-selected");
    }

    const idValue = String(getAttribute(feature, CONFIG.copyField) ?? "—");
    const secondary = getListSecondary(feature);

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "feature-open";
    openButton.dataset.objectId = String(oid ?? "");

    const type = document.createElement("span");
    type.className = "feature-type";
    type.textContent = "⚡ Elektrisch aansluitpunt";

    const id = document.createElement("strong");
    id.className = "feature-id";
    id.textContent = idValue;

    const secondaryEl = document.createElement("span");
    secondaryEl.className = "feature-secondary";
    secondaryEl.textContent = secondary;
    secondaryEl.hidden = !secondary;

    openButton.append(type, id, secondaryEl);
    openButton.addEventListener("click", () =>
      selectFeature(feature, { zoom: true, openPopup: true, openDetails: true })
    );

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "feature-copy";
    copyButton.title = `Kopieer ${idValue}`;
    copyButton.setAttribute("aria-label", `Kopieer ID ${idValue}`);
    copyButton.textContent = "⧉";
    copyButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      await handleCopy(idValue);
    });

    item.append(openButton, copyButton);
    fragment.appendChild(item);
  }

  featureListElement.appendChild(fragment);
}

async function selectFeature(feature, options = {}) {
  if (!feature) return;

  selectedFeature = feature;
  selectedObjectId = getObjectId(feature);
  selectedIndex = filteredFeatures.findIndex(
    (f) => Number(getObjectId(f)) === Number(selectedObjectId)
  );

  renderDetails(feature);
  updateHighlight(feature);
  updateSelectedListItem(options.scrollList === true);
  syncPager();

  if (options.openDetails) {
    showPanel("details");
  }

  if (options.zoom && feature.geometry) {
    try {
      await view.goTo(
        { target: feature.geometry, zoom: Math.max(view.zoom ?? 0, 17) },
        { duration: 650 }
      );
    } catch (error) {
      if (error?.name !== "AbortError") console.warn("Zoom mislukt:", error);
    }
  }

  if (options.openPopup) {
    try {
      await popup.open({ features: [feature], location: feature.geometry });
    } catch (error) {
      console.warn("Popup openen mislukt:", error);
    }
  }

  if (window.innerWidth <= 900 && options.openDetails) {
    sidePanel.classList.add("is-open");
  }
}

function renderDetails(feature) {
  const idValue = String(getAttribute(feature, CONFIG.copyField) ?? "—");

  noSelection.hidden = true;
  featureDetails.hidden = false;

  detailTitle.textContent = `ID: ${idValue}`;
  assetIdLine.textContent = `ID: ${idValue}`;
  footerId.textContent = `ID: ${idValue}`;

  const locationValues = readFields(feature, fieldProfile.locationFields);
  locationBlock.hidden = locationValues.length === 0;

  if (locationValues.length) {
    locationPrimary.textContent = locationValues[0] ?? "";
    locationSecondary.textContent = locationValues.slice(1).join(" · ");
    locationSecondary.hidden = locationValues.length < 2;
  }

  const current = firstValue(feature, fieldProfile.currentFields);
  currentBlock.hidden = current == null;
  if (current != null) {
    currentValue.textContent = formatAmpere(current);
  }

  attributeRows.replaceChildren();

  const rows = [];
  for (const fieldName of fieldProfile.connectionFields) {
    const field = targetLayer.fields.find((f) => f.name === fieldName);
    const value = getAttribute(feature, fieldName);
    if (value == null || String(value).trim() === "") continue;
    rows.push({
      label: field?.alias || fieldName,
      value: formatAttributeValue(value)
    });
  }

  attributesBlock.hidden = rows.length === 0;

  for (const row of rows.slice(0, 7)) {
    const div = document.createElement("div");
    div.className = "attribute-row";

    const label = document.createElement("span");
    label.textContent = row.label;

    const value = document.createElement("span");
    value.className = "value";
    value.textContent = row.value;

    div.append(label, value);
    attributeRows.appendChild(div);
  }
}

function navigateRelative(delta) {
  if (!filteredFeatures.length) return;

  let index = selectedIndex;
  if (index < 0) index = delta > 0 ? -1 : 0;

  const next = index + delta;
  if (next < 0 || next >= filteredFeatures.length) return;

  selectFeature(filteredFeatures[next], {
    zoom: true,
    openPopup: false,
    openDetails: true,
    scrollList: true
  });
}

function syncPager() {
  if (!filteredFeatures.length) {
    pagerText.textContent = "0 van 0";
    previousFeatureButton.disabled = true;
    nextFeatureButton.disabled = true;
    return;
  }

  const current = selectedIndex >= 0 ? selectedIndex + 1 : 0;
  pagerText.textContent = `${current} van ${filteredFeatures.length}`;
  previousFeatureButton.disabled = selectedIndex <= 0;
  nextFeatureButton.disabled =
    selectedIndex < 0 || selectedIndex >= filteredFeatures.length - 1;
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

function updateSelectedListItem(scroll) {
  for (const element of featureListElement.querySelectorAll(".feature-item")) {
    element.classList.remove("is-selected");
  }

  if (selectedObjectId == null) return;

  const openButton = Array.from(
    featureListElement.querySelectorAll(".feature-open")
  ).find(
    (el) => Number(el.dataset.objectId) === Number(selectedObjectId)
  );

  const item = openButton?.closest(".feature-item");
  if (!item) return;

  item.classList.add("is-selected");
  if (scroll) item.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function buildFieldProfile(fields, copyField) {
  const usable = (fields || []).filter(
    (field) =>
      field.name.toLowerCase() !== copyField.toLowerCase() &&
      !["oid", "geometry", "global-id", "guid", "blob", "raster"].includes(field.type)
  );

  const score = (field, terms) => {
    const hay = `${field.name} ${field.alias}`.toLowerCase();
    let best = 999;
    terms.forEach((term, index) => {
      if (hay.includes(term)) best = Math.min(best, index);
    });
    return best;
  };

  const locationTerms = [
    "locatie", "location", "adres", "address", "straat", "street",
    "plaats", "site", "gebouw", "kasteel", "naam", "name"
  ];

  const currentTerms = [
    "totale_stroomsterkte", "totale stroomsterkte", "stroomsterkte",
    "ampere", "ampère", "current"
  ];

  const connectionTerms = [
    "aansluiting", "aansluitingen", "cee", "spanning", "voltage",
    "380", "400", "230", "fase", "phase", "stekker", "stopcontact",
    "vermogen", "power", "aantal", "count"
  ];

  const pick = (terms, limit) =>
    [...usable]
      .map((field) => ({ field, rank: score(field, terms) }))
      .filter((x) => x.rank < 999)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit)
      .map((x) => x.field.name);

  return {
    locationFields: pick(locationTerms, 2),
    currentFields: pick(currentTerms, 2),
    connectionFields: pick(connectionTerms, 7)
  };
}

function getListSecondary(feature) {
  return readFields(feature, fieldProfile?.locationFields || []).join(" · ");
}

function readFields(feature, fieldNames = []) {
  return fieldNames
    .map((name) => getAttribute(feature, name))
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .map((value) => String(value).trim())
    .filter((value, index, array) => array.indexOf(value) === index);
}

function firstValue(feature, fieldNames = []) {
  for (const name of fieldNames) {
    const value = getAttribute(feature, name);
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return null;
}

function formatAmpere(value) {
  const text = String(value).trim();
  return /a$/i.test(text) ? text : `${text} A`;
}

function formatAttributeValue(value) {
  if (typeof value === "number") return new Intl.NumberFormat("nl-BE").format(value);
  return String(value);
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

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

async function handleCopy(value) {
  if (value == null || String(value).trim() === "") {
    showToast(`Veld "${CONFIG.copyField}" is leeg of niet beschikbaar.`, true);
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

  if (!ok) throw new Error("Clipboard fallback failed");
}
