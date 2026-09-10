import { CONFIG } from "./config.js";

const mapElement = document.getElementById("map");
const toastElement = document.getElementById("toast");

const [
  OAuthInfo,
  identityManager,
  reactiveUtils,
  ActionButton
] = await $arcgis.import([
  "@arcgis/core/identity/OAuthInfo.js",
  "@arcgis/core/identity/IdentityManager.js",
  "@arcgis/core/core/reactiveUtils.js",
  "@arcgis/core/support/actions/ActionButton.js"
]);

// Registreer OAuth vóór de WebMap wordt geladen.
// Bij een publieke kaart mag oauthClientId leeg blijven.
if (CONFIG.oauthClientId?.trim()) {
  const oauthInfo = new OAuthInfo({
    appId: CONFIG.oauthClientId.trim(),
    portalUrl: CONFIG.portalUrl,
    popup: false,
    preserveUrlHash: true
  });

  identityManager.registerOAuthInfos([oauthInfo]);
}

// De WebMap pas nu koppelen, zodat OAuth al geregistreerd is.
mapElement.setAttribute("item-id", CONFIG.webmapId);

await mapElement.viewOnReady();

const popup = mapElement.popupElement;

if (!popup) {
  throw new Error(
    "De Popup component kon niet worden gevonden. Controleer of popup-component-enabled op <arcgis-map> staat."
  );
}

const copyAction = new ActionButton({
  id: "copy-selected-id",
  title: CONFIG.copyActionTitle,
  icon: "copy"
});

// Voeg de knop toe aan de bestaande popup.
// De popup-inhoud uit de WebMap blijft behouden.
popup.actions.add(copyAction);

reactiveUtils.watch(
  () => popup.selectedFeature,
  (feature) => {
    const value = getConfiguredAttribute(feature);
    copyAction.disabled = value === null || value === undefined || String(value).trim() === "";
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

  // Eerst exacte veldnaam.
  if (Object.prototype.hasOwnProperty.call(attributes, CONFIG.copyField)) {
    return attributes[CONFIG.copyField];
  }

  // Daarna case-insensitive, zodat ID/id/Id niet onnodig problemen geeft.
  const wanted = CONFIG.copyField.toLowerCase();
  const actualKey = Object.keys(attributes).find(
    (key) => key.toLowerCase() === wanted
  );

  return actualKey ? attributes[actualKey] : null;
}

async function copyToClipboard(text) {
  // Azure Static Web Apps draait via HTTPS, dus de Clipboard API kan hier
  // normaal rechtstreeks worden gebruikt vanuit de klik op de popup-action.
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback voor oudere/afwijkende browsers.
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
  }, 2200);
}
