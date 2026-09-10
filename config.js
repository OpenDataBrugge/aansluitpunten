// Pas alleen dit bestand aan voor jouw omgeving.
export const CONFIG = {
  // Jouw bestaande ArcGIS Online WebMap:
  webmapId: "b7e5456ea5054b3dbb1d9c4802a34ca",

  // ArcGIS Online. Gebruik eventueel de organisatie-URL,
  // bijvoorbeeld: https://mijnorganisatie.maps.arcgis.com
  portalUrl: "https://www.arcgis.com",

  // Zet hier de Client ID van je ArcGIS Online OAuth-credentials.
  // Laat leeg als de WebMap en alle gebruikte services publiek zijn.
  oauthClientId: "",

  // LET OP: dit moet de echte veldnaam zijn, niet alleen de veld-alias.
  // Voor nu staat hij op "ID".
  copyField: "AANSLUITPUNT_ID",

  copyActionTitle: "Kopieer ID"
};
