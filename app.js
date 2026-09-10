import { CONFIG } from "./config.js";

const mapElement = document.getElementById("map");
const toastElement = document.getElementById("toast");

const [
  esriConfig,
  WebMap,
  ActionButton,
  reactiveUtils
] = await $arcgis.import([
  "@arcgis/core/config.js",
  "@arcgis/core/WebMap.js",
  "@arcgis/core/support/actions/ActionButton.js",
  "@arcgis/core/core/reactiveUtils.js"
]);

// BELANGRIJK:
// config.js van deze app is alleen onze eigen configuratie.
// We moeten de portal-URL ook expliciet aan de ArcGIS SDK doorgeven.
esriConfig.portalUrl = CONFIG.portalUrl;

// Maak de WebMap expliciet aan en geef de juiste ArcGIS Online-organisatie
// mee aan het PortalItem. Zo zijn we niet afhankelijk van de standaard
// www.arcgis.com portal of van timing van het <arcgis-map> component.
const webmap = new WebMap({
  portalItem: {
    id: CONFIG.webmapId,
    portal: {
      url: CONFIG.portalUrl
    }
  }
});

mapElement.map = webmap;

try {
  await webmap.load();
  console.info("WebMap geladen:", {
    title: webmap.portalItem?.title,
    id: webmap.portalItem?.id,
    portal: webmap.portalItem?.portal?.url
  });
} catch (error) {
  console.error("WebMap laden mislukt:", error);
  console.error("WebMap configuratie:", {
    webmapId: CONFIG.webmapId,
    portalUrl: CONFIG.portalUrl
  });
  showToast("WebMap kon niet worden geladen. Open de browserconsole voor details.", true);
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

// Voeg de knop toe aan de bestaande popupconfiguratie van de WebMap.
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

let toastTimer;

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);

  toastElement.textContent = message;
  toastElement.classList.toggle("toast--error", isError);
  toastElement.classList.add("toast--visible");

  toastTimer = window.setTimeout(() => {
    toastElement.classList.remove("toast--visible");
  }, 2600);
}
