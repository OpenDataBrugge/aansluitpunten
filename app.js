import { CONFIG } from "./config.js?v=4";

const APP_VERSION = "4.0.0";
console.info(`Aansluitpunten app v${APP_VERSION}`);

const mapElement = document.getElementById("map");
const toastElement = document.getElementById("toast");

// Dit moet vóór elke mogelijke foutmelding bestaan.
let toastTimer = null;

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);

  toastElement.textContent = message;
  toastElement.classList.toggle("toast--error", isError);
  toastElement.classList.add("toast--visible");

  toastTimer = window.setTimeout(() => {
    toastElement.classList.remove("toast--visible");
  }, 3000);
}

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

// BELANGRIJK:
// De webmap en lagen zijn publiek in ArcGIS Online.
// Gebruik daarom de publieke ArcGIS Online portal en NIET
// stadbrugge.maps.arcgis.com. Dat voorkomt de CORS-call naar
// /sharing/rest/portals/self op de organisatie-URL.
esriConfig.portalUrl = "https://www.arcgis.com";

console.info("Configuratie:", {
  version: APP_VERSION,
  webmapId: CONFIG.webmapId,
  portalUrl: esriConfig.portalUrl,
  copyField: CONFIG.copyField
});

let portalItem;

try {
  portalItem = new PortalItem({
    id: CONFIG.webmapId
  });

  await portalItem.load();

  console.info("PortalItem geladen:", {
    id: portalItem.id,
    title: portalItem.title,
    type: portalItem.type,
    access: portalItem.access,
    owner: portalItem.owner,
    portal: portalItem.portal?.url
  });

  if (portalItem.type !== "Web Map") {
    throw new Error(
      `Item ${CONFIG.webmapId} is van type "${portalItem.type}" en niet "Web Map".`
    );
  }
} catch (error) {
  console.error("PortalItem laden mislukt:", error);
  console.error(
    "Controle-URL:",
    `https://www.arcgis.com/sharing/rest/content/items/${CONFIG.webmapId}?f=pjson`
  );
  showToast("ArcGIS Online-item kon niet worden geladen. Zie browserconsole.", true);
  throw error;
}

const webmap = new WebMap({ portalItem });
mapElement.map = webmap;

try {
  await webmap.load();
  console.info("WebMap geladen:", webmap.portalItem?.title);
} catch (error) {
  console.error("WebMap laden mislukt:", error);
  showToast("WebMap kon niet worden geladen. Zie browserconsole.", true);
  throw error;
}

await mapElement.viewOnReady();

const popup = mapElement.popupElement;

if (!popup) {
  throw new Error(
    "De Popup component kon niet worden gevonden. Controleer popup-component-enabled op <arcgis-map>."
  );
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
    const value = getConfiguredAttribute(feature);
    copyAction.disabled =
      value === null ||
      value === undefined ||
      String(value).trim() === "";
  },
  { initial: true }
);

popup.addEventListener("arcgisTriggerAction", async (event) => {
  if (event.detail.action.id !== copyAction.id) return;

  const feature = popup.selectedFeature;
  const value = getConfiguredAttribute(feature);

  if (value === null || value === undefined || String(value).trim() === "") {
    showToast(`Veld "${CONFIG.copyField}" is niet gevuld of niet gevonden.`, true);
    console.warn(
      `Kopieerveld "${CONFIG.copyField}" niet gevonden. Beschikbare attributen:`,
      feature?.attributes ? Object.keys(feature.attributes) : []
    );
    return;
  }

  try {
    await copyToClipboard(String(value));
    showToast(`✓ Gekopieerd: ${value}`);
  } catch (error) {
    console.error("Kopiëren mislukt:", error);
    showToast("Kopiëren naar het klembord is mislukt.", true);
  }
});

function getConfiguredAttribute(feature) {
  const attributes = feature?.attributes;
  if (!attributes) return null;

  if (Object.prototype.hasOwnProperty.call(attributes, CONFIG.copyField)) {
    return attributes[CONFIG.copyField];
  }

  const wanted = CONFIG.copyField.toLowerCase();
  const actualKey = Object.keys(attributes).find(
    (key) => key.toLowerCase() === wanted
  );

  return actualKey ? attributes[actualKey] : null;
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
