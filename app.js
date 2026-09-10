import { CONFIG } from "./config.js?v=12";

const APP_VERSION = "12.0.0";
console.info(`Stroomaansluitingen app v${APP_VERSION}`);

const $ = (id) => document.getElementById(id);
const mapElement = $("map");
const toastElement = $("toast");
const sidePanel = $("sidePanel");
const mobilePanelToggle = $("mobilePanelToggle");
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

let toastTimer = null;
let targetLayer = null;
let objectIdField = null;
let allFeatures = [];
let selectedFeature = null;
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

mobilePanelToggle.addEventListener("click", () => sidePanel.classList.toggle("is-open"));

const [esriConfig, PortalItem, WebMap, PopupTemplate, CustomContent, reactiveUtils] = await $arcgis.import([
  "@arcgis/core/config.js",
  "@arcgis/core/portal/PortalItem.js",
  "@arcgis/core/WebMap.js",
  "@arcgis/core/PopupTemplate.js",
  "@arcgis/core/popup/content/CustomContent.js",
  "@arcgis/core/core/reactiveUtils.js"
]);

esriConfig.portalUrl = "https://www.arcgis.com";

const portalItem = new PortalItem({ id: CONFIG.webmapId });
await portalItem.load();
if (portalItem.type !== "Web Map") throw new Error(`Item ${CONFIG.webmapId} is geen Web Map.`);

const webmap = new WebMap({ portalItem });
mapElement.map = webmap;
await webmap.loadAll();
await mapElement.viewOnReady();

const view = mapElement.view;
const popup = mapElement.popupElement;

targetLayer = await findLayerWithField(webmap, CONFIG.copyField);
if (!targetLayer) throw new Error(`Geen laag gevonden met veld ${CONFIG.copyField}.`);

objectIdField = targetLayer.objectIdField;
fieldProfile = buildFieldProfile(targetLayer.fields, CONFIG.copyField);
try { layerView = await view.whenLayerView(targetLayer); } catch (e) { console.warn(e); }
installCompactPopup();
await loadFeatureIndex();

reactiveUtils.watch(
  () => popup?.selectedFeature,
  (feature) => {
    if (!feature) return;
    const value = getAttribute(feature, CONFIG.copyField);
    if (value != null && String(value).trim() !== "") selectFeature(feature);
  },
  { initial: true }
);

copyDetailId.addEventListener("click", async () => {
  await handleCopy(getAttribute(selectedFeature, CONFIG.copyField));
});
previousFeatureButton.addEventListener("click", () => navigateRelative(-1));
nextFeatureButton.addEventListener("click", () => navigateRelative(1));

function selectFeature(feature) {
  selectedFeature = feature;
  const oid = getObjectId(feature);
  selectedIndex = allFeatures.findIndex((f) => Number(getObjectId(f)) === Number(oid));

  // Expliciete klassen i.p.v. alleen het HTML hidden-attribuut.
  noSelection.classList.add("is-hidden");
  featureDetails.classList.remove("is-hidden");
  renderDetails(feature);
  updateHighlight(feature);
  syncPager();

  if (window.innerWidth <= 900) sidePanel.classList.add("is-open");
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
        { target: feature.geometry, zoom: CONFIG.pagerZoom ?? 16.5 },
        { duration: 700, easing: "ease-in-out" }
      );
      await popup.open({ features: [feature], location: feature.geometry });
    } catch (error) {
      if (error?.name !== "AbortError") console.warn("Navigatie mislukt:", error);
    } finally {
      syncPager();
    }
  }
}

function renderDetails(feature) {
  const idValue = String(getAttribute(feature, CONFIG.copyField) ?? "—");
  detailTitle.textContent = `ID: ${idValue}`;
  assetIdLine.textContent = `ID: ${idValue}`;
  footerId.textContent = `ID: ${idValue}`;

  const locationValues = readFields(feature, fieldProfile.locationFields);
  locationBlock.classList.toggle("is-hidden", locationValues.length === 0);
  if (locationValues.length) {
    locationPrimary.textContent = locationValues[0];
    locationSecondary.textContent = locationValues.slice(1).join(" · ");
    locationSecondary.classList.toggle("is-hidden", locationValues.length < 2);
  }

  const current = firstValue(feature, fieldProfile.currentFields);
  currentBlock.classList.toggle("is-hidden", current == null);
  if (current != null) currentValue.textContent = formatAmpere(current);

  const rows = getConnectionRows(feature);
  attributeRows.replaceChildren();
  attributesBlock.classList.toggle("is-hidden", rows.length === 0);
  rows.slice(0, 7).forEach((row) => {
    const div = document.createElement("div");
    div.className = "attribute-row";
    const label = document.createElement("span");
    label.textContent = row.label;
    const value = document.createElement("span");
    value.className = "value";
    value.textContent = row.value;
    div.append(label, value);
    attributeRows.appendChild(div);
  });
}

function installCompactPopup() {
  const customContent = new CustomContent({
    outFields: ["*"],
    creator: (event) => createCompactPopupContent(event.graphic)
  });
  targetLayer.popupTemplate = new PopupTemplate({
    outFields: ["*"],
    title: `ID: {${CONFIG.copyField}}`,
    content: [customContent],
    overwriteActions: true,
    actions: []
  });
}

function createCompactPopupContent(feature) {
  const root = document.createElement("div");
  root.style.cssText = "font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.3;width:100%;max-width:390px;color:#17191c";
  const idValue = String(getAttribute(feature, CONFIG.copyField) ?? "—");
  const locationValues = readFields(feature, fieldProfile.locationFields);
  const current = firstValue(feature, fieldProfile.currentFields);
  const rows = getConnectionRows(feature).slice(0, 5);

  const card = document.createElement("div");
  card.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;background:#214b7b;color:white;padding:9px 10px;border-radius:5px";
  const text = document.createElement("div");
  text.innerHTML = `<strong style="display:block;font-size:12px">⚡ Elektrisch aansluitpunt</strong><span style="display:block;font-size:10px;margin-top:2px">ID: ${escapeHtml(idValue)}</span>`;
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "⧉ Kopieer";
  copy.style.cssText = "border:1px solid rgba(255,255,255,.45);background:rgba(255,255,255,.08);color:white;border-radius:3px;padding:5px 7px;font:inherit;font-size:10px;cursor:pointer";
  copy.addEventListener("click", () => handleCopy(idValue));
  card.append(text, copy);
  root.append(card);

  if (locationValues.length) {
    const loc = document.createElement("div");
    loc.style.cssText = "padding:8px 9px 7px;font-size:10px";
    loc.innerHTML = `<div style="font-size:9px;color:#83878e;margin-bottom:2px">📍 LOCATIE</div><div style="font-size:11px">${escapeHtml(locationValues[0])}</div>${locationValues[1] ? `<div style="color:#565b63;margin-top:1px">${escapeHtml(locationValues[1])}</div>` : ""}`;
    root.append(loc);
  }

  if (current != null) {
    const box = document.createElement("div");
    box.style.cssText = "background:#e7f3ff;border:1px solid #a9cfee;padding:8px 9px;margin-top:2px";
    box.innerHTML = `<div style="font-size:8px;color:#3167a5">TOTALE STROOMSTERKTE</div><strong style="display:block;font-size:12px;margin-top:2px">${escapeHtml(formatAmpere(current))}</strong>`;
    root.append(box);
  }

  if (rows.length) {
    const table = document.createElement("div");
    table.style.cssText = "border:1px solid #ededf0;margin-top:5px";
    const head = document.createElement("div");
    head.style.cssText = "display:grid;grid-template-columns:minmax(0,1fr)65px;background:#f4f4f4;padding:5px 7px;font-weight:bold;font-size:9px";
    head.innerHTML = "<span>Aansluitingen</span><span style='text-align:right'>Waarde</span>";
    table.append(head);
    rows.forEach((row, i) => {
      const line = document.createElement("div");
      line.style.cssText = `display:grid;grid-template-columns:minmax(0,1fr) 65px;padding:4px 7px;font-size:9px;background:${i % 2 === 0 ? "#fff0f0" : "#fff"}`;
      const l = document.createElement("span"); l.textContent = row.label;
      const v = document.createElement("span"); v.textContent = row.value; v.style.textAlign = "right";
      line.append(l, v); table.append(line);
    });
    root.append(table);
  }
  return root;
}

async function loadFeatureIndex() {
  const q = targetLayer.createQuery();
  q.where = "1=1"; q.outFields = ["*"]; q.returnGeometry = true;
  const result = await targetLayer.queryFeatures(q);
  allFeatures = result.features.sort((a, b) =>
    String(getAttribute(a, CONFIG.copyField) ?? "").localeCompare(String(getAttribute(b, CONFIG.copyField) ?? ""), "nl", { numeric: true, sensitivity: "base" })
  );
  syncPager();
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
  nextFeatureButton.disabled = selectedIndex < 0 || selectedIndex >= allFeatures.length - 1;
}

async function findLayerWithField(map, fieldName) {
  for (const layer of map.allLayers.toArray()) {
    if (layer.type !== "feature") continue;
    try {
      await layer.load();
      if (layer.fields?.some((f) => f.name.toLowerCase() === fieldName.toLowerCase())) return layer;
    } catch (e) { console.warn(`Laag overslaan: ${layer.title}`, e); }
  }
  return null;
}

function updateHighlight(feature) {
  highlightHandle?.remove(); highlightHandle = null;
  if (!layerView) return;
  const oid = getObjectId(feature);
  if (oid == null) return;
  try { highlightHandle = layerView.highlight(oid); } catch (e) { console.warn(e); }
}

function buildFieldProfile(fields, copyField) {
  const usable = (fields || []).filter((f) => f.name.toLowerCase() !== copyField.toLowerCase() && !["oid","geometry","global-id","guid","blob","raster"].includes(f.type));
  const pick = (terms, limit) => usable
    .map((field) => ({ field, rank: scoreField(field, terms) }))
    .filter((x) => x.rank < 999)
    .sort((a,b) => a.rank - b.rank)
    .slice(0, limit)
    .map((x) => x.field.name);
  return {
    locationFields: pick(["locatie","location","adres","address","straat","street","plaats","site","gebouw","naam","name"], 2),
    currentFields: pick(["totale_stroomsterkte","totale stroomsterkte","stroomsterkte","ampere","ampère","current"], 2),
    connectionFields: pick(["aansluiting","aansluitingen","cee","spanning","voltage","380","400","230","fase","phase","stekker","stopcontact","vermogen","power","aantal","count"], 7)
  };
}
function scoreField(field, terms) {
  const hay = `${field.name} ${field.alias}`.toLowerCase();
  let best = 999;
  terms.forEach((term, i) => { if (hay.includes(term)) best = Math.min(best, i); });
  return best;
}
function getConnectionRows(feature) {
  return (fieldProfile?.connectionFields || []).flatMap((name) => {
    const field = targetLayer.fields.find((f) => f.name === name);
    const value = getAttribute(feature, name);
    return value == null || String(value).trim() === "" ? [] : [{ label: field?.alias || name, value: formatAttributeValue(value) }];
  });
}
function readFields(feature, names = []) {
  return names.map((n) => getAttribute(feature, n)).filter((v) => v != null && String(v).trim() !== "").map((v) => String(v).trim()).filter((v,i,a) => a.indexOf(v) === i);
}
function firstValue(feature, names = []) {
  for (const n of names) { const v = getAttribute(feature, n); if (v != null && String(v).trim() !== "") return v; }
  return null;
}
function getObjectId(feature) {
  if (!feature?.attributes) return null;
  if (objectIdField && feature.attributes[objectIdField] != null) return feature.attributes[objectIdField];
  const key = Object.keys(feature.attributes).find((n) => n.toLowerCase() === "objectid");
  return key ? feature.attributes[key] : null;
}
function getAttribute(feature, fieldName) {
  const attrs = feature?.attributes; if (!attrs) return null;
  if (Object.prototype.hasOwnProperty.call(attrs, fieldName)) return attrs[fieldName];
  const actual = Object.keys(attrs).find((n) => n.toLowerCase() === fieldName.toLowerCase());
  return actual ? attrs[actual] : null;
}
function formatAmpere(value) { const t = String(value).trim(); return /a$/i.test(t) ? t : `${t} A`; }
function formatAttributeValue(value) { return typeof value === "number" ? new Intl.NumberFormat("nl-BE").format(value) : String(value); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
async function handleCopy(value) {
  if (value == null || String(value).trim() === "") return showToast(`Veld ${CONFIG.copyField} is leeg.`, true);
  try { await copyToClipboard(String(value)); showToast(`✓ Gekopieerd: ${value}`); }
  catch (e) { console.error(e); showToast("Kopiëren is mislukt.", true); }
}
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", "");
  ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
  const ok = document.execCommand("copy"); ta.remove(); if (!ok) throw new Error("Clipboard fallback failed");
}
