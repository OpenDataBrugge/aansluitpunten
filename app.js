import { CONFIG } from "./config.js?v=23";

const APP_VERSION = "23.0.0";
console.info(`Stroomaansluitingen app v${APP_VERSION}`);

const $ = (id) => document.getElementById(id);

const mapElement = $("map");
const toastElement = $("toast");
const sidePanel = $("sidePanel");
const mobilePanelToggle = $("mobilePanelToggle");
const mobilePanelClose = $("mobilePanelClose");
const mobilePanelBackdrop = $("mobilePanelBackdrop");

const helpButton = $("helpButton");
const helpOverlay = $("helpOverlay");
const helpDialog = $("helpDialog");
const closeHelpButton = $("closeHelpButton");
const closeHelpFooterButton = $("closeHelpFooterButton");

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

const singleModeButton = $("singleModeButton");
const areaModeButton = $("areaModeButton");
const singleModePanel = $("singleModePanel");
const areaModePanel = $("areaModePanel");
const singleDetailsScroll = $("singleDetailsScroll");
const areaEmptyState = $("areaEmptyState");

const drawAreaButton = $("drawAreaButton");
const drawAreaButtonText = $("drawAreaButtonText");
const clearAreaButton = $("clearAreaButton");
const areaInstruction = $("areaInstruction");
const areaSelectionResult = $("areaSelectionResult");
const areaSelectionCount = $("areaSelectionCount");
const areaSelectedDetails = $("areaSelectedDetails");
const copyAreaIdsButton = $("copyAreaIdsButton");
const copyAreaIdsButtonText = $("copyAreaIdsButtonText");

let toastTimer = null;
let targetLayer = null;
let objectIdField = null;
let allFeatures = [];
let selectedFeature = null;
let selectedIndex = -1;
let layerView = null;
let highlightHandle = null;
let areaHighlightHandle = null;
let FIELD = null;

let selectionLayer = null;
let sketchViewModel = null;
let selectionMode = "single";
let areaDrawing = false;
let areaSelectedFeatures = [];
let areaSelectedIds = [];

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

const MOBILE_BREAKPOINT = 900;
const mobileMedia = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

function isMobileLayout() {
  return mobileMedia.matches;
}

function openMobilePanel() {
  if (!isMobileLayout()) return;

  sidePanel.classList.add("is-open");
  mobilePanelBackdrop.classList.remove("is-hidden");
  mobilePanelBackdrop.setAttribute("aria-hidden", "false");
  mobilePanelToggle.setAttribute("aria-expanded", "true");
}

function closeMobilePanel() {
  if (!isMobileLayout()) return;

  sidePanel.classList.remove("is-open");
  mobilePanelBackdrop.classList.add("is-hidden");
  mobilePanelBackdrop.setAttribute("aria-hidden", "true");
  mobilePanelToggle.setAttribute("aria-expanded", "false");
}

function toggleMobilePanel() {
  if (!isMobileLayout()) return;

  if (sidePanel.classList.contains("is-open")) {
    closeMobilePanel();
  } else {
    openMobilePanel();
  }
}

function syncResponsiveLayout() {
  if (isMobileLayout()) {
    mobilePanelToggle.setAttribute(
      "aria-expanded",
      String(sidePanel.classList.contains("is-open"))
    );
    return;
  }

  // Op desktop is het zijpaneel altijd zichtbaar en is geen backdrop nodig.
  sidePanel.classList.remove("is-open");
  mobilePanelBackdrop.classList.add("is-hidden");
  mobilePanelBackdrop.setAttribute("aria-hidden", "true");
  mobilePanelToggle.setAttribute("aria-expanded", "false");
}

mobilePanelToggle.setAttribute("aria-controls", "sidePanel");
mobilePanelToggle.setAttribute("aria-expanded", "false");

mobilePanelToggle.addEventListener("click", toggleMobilePanel);
mobilePanelClose.addEventListener("click", closeMobilePanel);
mobilePanelBackdrop.addEventListener("click", closeMobilePanel);

if (typeof mobileMedia.addEventListener === "function") {
  mobileMedia.addEventListener("change", syncResponsiveLayout);
} else {
  mobileMedia.addListener(syncResponsiveLayout);
}

syncResponsiveLayout();

let helpPreviouslyFocused = null;

function openHelp() {
  helpPreviouslyFocused = document.activeElement;
  helpOverlay.classList.remove("is-hidden");
  helpOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("help-open");

  requestAnimationFrame(() => {
    closeHelpButton.focus();
  });
}

function closeHelp() {
  helpOverlay.classList.add("is-hidden");
  helpOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("help-open");

  if (helpPreviouslyFocused && typeof helpPreviouslyFocused.focus === "function") {
    helpPreviouslyFocused.focus();
  }
}

helpButton.addEventListener("click", openHelp);
closeHelpButton.addEventListener("click", closeHelp);
closeHelpFooterButton.addEventListener("click", closeHelp);

helpOverlay.addEventListener("click", (event) => {
  if (event.target === helpOverlay) {
    closeHelp();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !helpOverlay.classList.contains("is-hidden")) {
    closeHelp();
  }
});

const [
  esriConfig,
  PortalItem,
  WebMap,
  GraphicsLayer,
  SketchViewModel
] = await $arcgis.import([
  "@arcgis/core/config.js",
  "@arcgis/core/portal/PortalItem.js",
  "@arcgis/core/WebMap.js",
  "@arcgis/core/layers/GraphicsLayer.js",
  "@arcgis/core/widgets/Sketch/SketchViewModel.js"
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

// Tijdelijke graphicslaag voor de getekende selectiepolygoon.
selectionLayer = new GraphicsLayer({
  title: "Gebiedsselectie",
  listMode: "hide"
});
webmap.add(selectionLayer);

sketchViewModel = new SketchViewModel({
  view,
  layer: selectionLayer,
  polygonSymbol: {
    type: "simple-fill",
    color: [13, 63, 219, 0.08],
    outline: {
      color: [13, 63, 219, 0.95],
      width: 2
    }
  }
});

sketchViewModel.on("create", async (event) => {
  if (event.state === "start") {
    areaDrawing = true;
    setDrawingUi(true);
  }

  if (event.state === "complete") {
    areaDrawing = false;
    setDrawingUi(false);
    await selectFeaturesInPolygon(event.graphic.geometry);

    if (isMobileLayout()) {
      openMobilePanel();
    }
  }

  if (event.state === "cancel") {
    areaDrawing = false;
    setDrawingUi(false);

    if (isMobileLayout()) {
      openMobilePanel();
    }
  }
});

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
  if (selectionMode !== "single" || areaDrawing) return;

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

singleModeButton.addEventListener("click", () => {
  setSelectionMode("single");
});

areaModeButton.addEventListener("click", () => {
  setSelectionMode("area");
});

drawAreaButton.addEventListener("click", () => {
  if (selectionMode !== "area") {
    setSelectionMode("area");
  }

  if (areaDrawing) {
    sketchViewModel.cancel();
    return;
  }

  startAreaDrawing();
});

clearAreaButton.addEventListener("click", () => {
  clearAreaSelection({
    keepInstruction: false,
    restoreSingle: false
  });
});

copyAreaIdsButton.addEventListener("click", async () => {
  if (!areaSelectedIds.length) return;

  try {
    const separator = CONFIG.areaCopySeparator ?? "\n";
    const copyIds = [
      ...new Set(
        areaSelectedIds
          .map((value) => getCopyId(value))
          .filter(Boolean)
      )
    ];

    await copyToClipboard(copyIds.join(separator));
    showToast(`✓ ${copyIds.length} ID's gekopieerd`);
  } catch (error) {
    console.error("Gebieds-ID's kopiëren mislukt:", error);
    showToast("Kopiëren van de geselecteerde ID's is mislukt.", true);
  }
});

function setSelectionMode(mode) {
  if (mode !== "single" && mode !== "area") return;
  if (selectionMode === mode) return;

  selectionMode = mode;

  const isSingle = mode === "single";

  singleModeButton.classList.toggle("is-active", isSingle);
  areaModeButton.classList.toggle("is-active", !isSingle);

  singleModeButton.setAttribute("aria-pressed", String(isSingle));
  areaModeButton.setAttribute("aria-pressed", String(!isSingle));

  if (isSingle) {
    // Gebiedsselectie volledig opruimen zodat er geen twee selecties tegelijk
    // zichtbaar blijven.
    clearAreaSelection({
      keepInstruction: false,
      restoreSingle: false
    });

    areaModePanel.classList.add("is-hidden");
    singleModePanel.classList.remove("is-hidden");
    singleDetailsScroll.classList.remove("is-hidden");

    areaSelectedDetails.classList.add("is-hidden");
    areaEmptyState.classList.remove("is-hidden");

    resetSingleSelection();
  } else {
    // Ook de selectie van één punt opruimen wanneer de gebruiker overschakelt
    // naar "Meerdere punten".
    resetSingleSelection();

    singleModePanel.classList.add("is-hidden");
    singleDetailsScroll.classList.add("is-hidden");
    areaModePanel.classList.remove("is-hidden");

    areaEmptyState.classList.remove("is-hidden");
    areaSelectedDetails.classList.add("is-hidden");

    areaInstruction.textContent =
      "Teken een polygoon om meerdere stroompunten te selecteren.";
  }
}

function resetSingleSelection() {
  selectedFeature = null;
  selectedIndex = -1;

  highlightHandle?.remove();
  highlightHandle = null;

  noSelection.classList.remove("is-hidden");
  featureDetails.classList.add("is-hidden");

  syncPager();
}

function startAreaDrawing() {
  // Nieuwe tekening vervangt de vorige gebiedsselectie.
  clearAreaSelection({
    keepInstruction: true,
    restoreSingle: false
  });

  areaDrawing = true;
  setDrawingUi(true);

  if (isMobileLayout()) {
    closeMobilePanel();
    showToast("Teken het gebied op de kaart en dubbelklik om af te sluiten.");
  }

  try {
    sketchViewModel.create("polygon");
  } catch (error) {
    areaDrawing = false;
    setDrawingUi(false);
    console.error("Polygoon tekenen kon niet starten:", error);
    showToast("De gebiedsselectie kon niet worden gestart.", true);
  }
}

function setDrawingUi(isDrawing) {
  drawAreaButton.classList.toggle("is-drawing", isDrawing);
  mapElement.classList.toggle("area-drawing", isDrawing);

  if (isDrawing) {
    drawAreaButtonText.textContent = "Annuleer tekenen";
    areaInstruction.textContent =
      "Klik op de kaart om de polygoon te tekenen. Dubbelklik om af te sluiten.";
  } else {
    drawAreaButtonText.textContent = "Selecteer gebied";

    if (!areaSelectedIds.length) {
      areaInstruction.textContent =
        "Teken een polygoon om meerdere stroompunten te selecteren.";
    }
  }
}

async function selectFeaturesInPolygon(polygon) {
  if (!polygon || !targetLayer) return;

  areaInstruction.textContent = "Stroompunten binnen het gebied worden gezocht…";
  copyAreaIdsButton.disabled = true;

  try {
    const query = targetLayer.createQuery();
    query.geometry = polygon;
    query.spatialRelationship = "intersects";
    query.outFields = ["*"];
    query.returnGeometry = true;

    const result = await targetLayer.queryFeatures(query);
    areaSelectedFeatures = result.features || [];

    areaSelectedIds = [
      ...new Set(
        areaSelectedFeatures
          .map((feature) => getFieldValue(feature, "id"))
          .filter((value) => value != null && String(value).trim() !== "")
          .map((value) => String(value).trim())
      )
    ].sort((a, b) =>
      a.localeCompare(b, "nl", { numeric: true, sensitivity: "base" })
    );

    updateAreaHighlight(areaSelectedFeatures);
    renderAreaSelectionResult();
  } catch (error) {
    console.error("Gebiedsselectie mislukt:", error);
    areaSelectedFeatures = [];
    areaSelectedIds = [];
    updateAreaHighlight([]);
    areaSelectionResult.classList.add("is-hidden");
    clearAreaButton.disabled = false;
    areaInstruction.textContent =
      "De stroompunten binnen dit gebied konden niet worden opgehaald.";
    showToast("Gebiedsselectie is mislukt.", true);
  }
}

function renderAreaSelectionResult() {
  const count = areaSelectedIds.length;

  areaSelectionResult.classList.remove("is-hidden");
  areaSelectionCount.textContent =
    count === 1
      ? "1 stroompunt geselecteerd"
      : `${count} stroompunten geselecteerd`;

  copyAreaIdsButton.disabled = count === 0;
  copyAreaIdsButtonText.textContent =
    count === 1 ? "Kopieer ID" : `Kopieer ${count} ID's`;

  clearAreaButton.disabled = false;

  areaInstruction.textContent =
    count === 0
      ? "Er liggen geen stroompunten binnen de getekende polygoon."
      : "De geselecteerde stroompunten zijn op de kaart gemarkeerd.";

  renderAreaSelectedDetails();
}

function renderAreaSelectedDetails() {
  areaSelectedDetails.replaceChildren();

  if (!areaSelectedFeatures.length) {
    areaSelectedDetails.classList.add("is-hidden");
    areaEmptyState.classList.remove("is-hidden");
    return;
  }

  areaEmptyState.classList.add("is-hidden");
  areaSelectedDetails.classList.remove("is-hidden");

  const heading = document.createElement("div");
  heading.className = "area-selected-heading";

  const title = document.createElement("h2");
  title.textContent = "Geselecteerde stroompunten";

  const count = document.createElement("span");
  count.textContent = `${areaSelectedFeatures.length} geselecteerd`;

  heading.append(title, count);
  areaSelectedDetails.appendChild(heading);

  const sortedFeatures = [...areaSelectedFeatures].sort((a, b) =>
    String(getFieldValue(a, "id") ?? "").localeCompare(
      String(getFieldValue(b, "id") ?? ""),
      "nl",
      { numeric: true, sensitivity: "base" }
    )
  );

  for (const feature of sortedFeatures) {
    areaSelectedDetails.appendChild(createSelectedPointCard(feature));
  }
}

function createSelectedPointCard(feature) {
  const card = document.createElement("article");
  card.className = "selected-point-card";

  const oid = getObjectId(feature);
  if (oid != null) {
    card.dataset.objectId = String(oid);
  }

  const id = textFieldValue(feature, "id") || "—";
  const adres = textFieldValue(feature, "adres");
  const ligging = textFieldValue(feature, "ligging");
  const totaal = numericFieldValue(feature, "totaal");

  // Header
  const header = document.createElement("div");
  header.className = "selected-point-header";

  const headerMain = document.createElement("div");
  headerMain.className = "selected-point-header-main";

  const headerTitle = document.createElement("strong");
  headerTitle.textContent = "⚡ Elektrisch aansluitpunt";

  const headerId = document.createElement("span");
  headerId.textContent = `ID: ${id}`;

  headerMain.append(headerTitle, headerId);

  const actions = document.createElement("div");
  actions.className = "selected-point-actions";

  const locateButton = document.createElement("button");
  locateButton.type = "button";
  locateButton.className = "selected-point-action";
  locateButton.title = "Toon op kaart";
  locateButton.setAttribute("aria-label", `Toon ${id} op kaart`);
  locateButton.textContent = "◎";
  locateButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    await focusAreaFeature(feature);
  });

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "selected-point-action";
  copyButton.title = "Kopieer ID";
  copyButton.setAttribute("aria-label", `Kopieer ID ${id}`);
  copyButton.textContent = "⧉";
  copyButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    await handleCopy(id);
  });

  actions.append(locateButton, copyButton);
  header.append(headerMain, actions);
  card.appendChild(header);

  // Locatie
  if (adres || ligging) {
    const location = document.createElement("div");
    location.className = "selected-point-location";

    const label = document.createElement("div");
    label.className = "selected-point-location-label";
    label.textContent = "📍 Locatie";
    location.appendChild(label);

    if (adres) {
      const address = document.createElement("div");
      address.className = "selected-point-address";
      address.textContent = adres;
      location.appendChild(address);
    }

    if (ligging) {
      const description = document.createElement("div");
      description.className = "selected-point-description";
      description.textContent = ligging;
      location.appendChild(description);
    }

    card.appendChild(location);
  }

  // Totale stroomsterkte
  const total = document.createElement("div");
  total.className = "selected-point-total";

  const totalLabel = document.createElement("div");
  totalLabel.className = "selected-point-total-label";
  totalLabel.textContent = "Totale stroomsterkte";

  const totalValue = document.createElement("strong");
  totalValue.textContent = `${formatNumber(totaal)} A`;

  total.append(totalLabel, totalValue);
  card.appendChild(total);

  // Aansluitingen
  const connectionData = getConnectionData(feature);

  if (connectionData.hasAny) {
    const connections = document.createElement("div");
    connections.className = "selected-connections";

    const head = document.createElement("div");
    head.className = "selected-connections-head";

    const headLabel = document.createElement("span");
    headLabel.textContent = "Aansluitingen";

    const headCount = document.createElement("span");
    headCount.textContent = "Aantal";

    head.append(headLabel, headCount);
    connections.appendChild(head);

    if (connectionData.stop16 !== 0) {
      connections.appendChild(
        createSelectedConnectionRow("🔌 Stopcontact 16 A", connectionData.stop16)
      );
    }

    if (connectionData.blueRows.length) {
      connections.appendChild(
        createSelectedConnectionGroup("🔵 Blauw — 230 V", "blue")
      );

      for (const [label, value] of connectionData.blueRows) {
        connections.appendChild(
          createSelectedConnectionRow(label, value)
        );
      }
    }

    if (connectionData.redRows.length) {
      connections.appendChild(
        createSelectedConnectionGroup("🔴 Rood — 380 V", "red")
      );

      for (const [label, value] of connectionData.redRows) {
        connections.appendChild(
          createSelectedConnectionRow(label, value)
        );
      }
    }

    card.appendChild(connections);
  }

  const footer = document.createElement("div");
  footer.className = "selected-point-footer";
  footer.textContent = `ID: ${id}`;
  card.appendChild(footer);

  return card;
}

function getConnectionData(feature) {
  const stop16 = numericFieldValue(feature, "stop16");

  const blueRows = [
    ["CEE 16 A", numericFieldValue(feature, "blauw16")],
    ["CEE 32 A", numericFieldValue(feature, "blauw32")],
    ["CEE 63 A", numericFieldValue(feature, "blauw63")]
  ].filter(([, value]) => value !== 0);

  const redRows = [
    ["CEE 16 A", numericFieldValue(feature, "rood16")],
    ["CEE 32 A", numericFieldValue(feature, "rood32")],
    ["CEE 63 A", numericFieldValue(feature, "rood63")],
    ["CEE 125 A", numericFieldValue(feature, "rood125")],
    ["CEE 250 A", numericFieldValue(feature, "rood250")]
  ].filter(([, value]) => value !== 0);

  return {
    stop16,
    blueRows,
    redRows,
    hasAny: stop16 !== 0 || blueRows.length > 0 || redRows.length > 0
  };
}

function createSelectedConnectionGroup(label, className) {
  const group = document.createElement("div");
  group.className = `selected-connection-group ${className}`;
  group.textContent = label;
  return group;
}

function createSelectedConnectionRow(label, value) {
  const row = document.createElement("div");
  row.className = "selected-connection-row";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("span");
  valueElement.className = "count";
  valueElement.textContent = formatNumber(value);

  row.append(labelElement, valueElement);
  return row;
}

async function focusAreaFeature(feature) {
  if (!feature?.geometry) return;

  // Op mobiel sluiten we het detailpaneel zodat het gekozen punt ook echt
  // zichtbaar is op de kaart. De gebruiker kan het paneel via de header
  // onmiddellijk opnieuw openen.
  if (isMobileLayout()) {
    closeMobilePanel();
  }

  // In gebiedsmodus blijft de meervoudige selectie actief. We zoomen enkel
  // naar het gekozen punt zonder van selectiemodus te veranderen.
  try {
    await view.goTo(
      {
        target: feature.geometry,
        zoom: CONFIG.pagerZoom ?? 16.5
      },
      {
        duration: 650,
        easing: "ease-in-out"
      }
    );
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.warn("Zoomen naar geselecteerd gebiedspunt mislukt:", error);
    }
  }
}

function updateAreaHighlight(features) {
  areaHighlightHandle?.remove();
  areaHighlightHandle = null;

  if (!layerView || !features?.length) return;

  const objectIds = features
    .map((feature) => getObjectId(feature))
    .filter((value) => value != null);

  if (!objectIds.length) return;

  try {
    areaHighlightHandle = layerView.highlight(objectIds);
  } catch (error) {
    console.warn("Gebiedshighlight mislukt:", error);
  }
}

function clearAreaSelection(options = {}) {
  const {
    keepInstruction = false,
    restoreSingle = true
  } = options;

  if (areaDrawing) {
    try {
      sketchViewModel.cancel();
    } catch (_) {
      // Geen actie nodig.
    }
  }

  areaDrawing = false;
  selectionLayer?.removeAll();

  areaHighlightHandle?.remove();
  areaHighlightHandle = null;

  areaSelectedFeatures = [];
  areaSelectedIds = [];

  areaSelectedDetails.replaceChildren();
  areaSelectedDetails.classList.add("is-hidden");
  areaEmptyState.classList.remove("is-hidden");

  areaSelectionResult.classList.add("is-hidden");
  copyAreaIdsButton.disabled = true;
  clearAreaButton.disabled = true;

  setDrawingUi(false);

  if (!keepInstruction) {
    areaInstruction.textContent =
      "Teken een polygoon om meerdere stroompunten te selecteren.";
  }

  if (restoreSingle && selectionMode === "single") {
    resetSingleSelection();
  }
}

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
  if (!feature || selectionMode !== "single") return;

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

  if (isMobileLayout()) {
    openMobilePanel();
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
  if (selectionMode !== "single" || !allFeatures.length) return;

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

function getCopyId(value) {
  if (value == null) return "";

  const text = String(value).trim();
  if (!text) return "";

  return text.split(/\s+/)[0];
}

async function handleCopy(value) {
  const copyValue = getCopyId(value);

  if (!copyValue) {
    showToast(`Veld ${CONFIG.copyField} is leeg.`, true);
    return;
  }

  try {
    await copyToClipboard(copyValue);
    showToast(`✓ Gekopieerd: ${copyValue}`);
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
