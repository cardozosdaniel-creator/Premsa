// Mapa esquemàtic de les 8 vegueries de Catalunya, en coordenades SVG
// aproximades (viewBox 0 0 500 380). No és cartografia oficial: cada polígon
// representa la forma i posició relativa de la vegueria per a interacció
// (hover, clic per filtrar). Cobreix les 8 vegueries oficials + Aran unida a
// l'Alt Pirineu.
//
// L'ordre dels punts de cada polígon és sentit horari. Els vèrtexs són a la
// vista SVG (x cap a l'est, y cap al sud); els noms coincideixen amb les claus
// que fem servir a vegueries-map.js.
window.VEGUERIA_SHAPES = [
  {
    key: "alt-pirineu-aran",
    label: "Alt Pirineu i Aran",
    // Franja septentrional que va d'oest a est, incloent la Vall d'Aran
    path: "M 30 40 L 210 15 L 270 30 L 320 55 L 300 95 L 250 105 L 180 95 L 100 100 L 55 90 Z",
    labelPos: [170, 68]
  },
  {
    key: "ponent",
    label: "Ponent",
    // Sud-oest de la franja pirinenca, ocupant les Terres de Lleida
    path: "M 55 90 L 100 100 L 180 95 L 200 175 L 175 235 L 90 240 L 50 190 L 45 130 Z",
    labelPos: [115, 175]
  },
  {
    key: "comarques-gironines",
    label: "Comarques Gironines",
    // Nord-est: Girona, Costa Brava
    path: "M 320 55 L 405 65 L 445 100 L 450 175 L 405 195 L 355 175 L 310 145 L 300 95 Z",
    labelPos: [380, 130]
  },
  {
    key: "catalunya-central",
    label: "Catalunya Central",
    // Bages, Anoia, Osona, Berguedà, Solsonès
    path: "M 180 95 L 250 105 L 300 145 L 310 195 L 275 220 L 210 210 L 200 175 Z",
    labelPos: [245, 165]
  },
  {
    key: "barcelona",
    label: "Barcelona",
    // Àrea metropolitana i litoral
    path: "M 310 195 L 355 175 L 405 195 L 405 245 L 350 265 L 300 245 L 275 220 Z",
    labelPos: [345, 225]
  },
  {
    key: "penedes",
    label: "Penedès",
    // Alt/Baix Penedès, Garraf, Anoia
    path: "M 210 210 L 275 220 L 300 245 L 265 285 L 220 285 L 195 250 Z",
    labelPos: [245, 255]
  },
  {
    key: "camp-tarragona",
    label: "Camp de Tarragona",
    // Alt/Baix Camp, Priorat, Conca, Tarragonès
    path: "M 175 235 L 200 250 L 220 285 L 210 320 L 155 335 L 105 305 L 105 260 Z",
    labelPos: [165, 290]
  },
  {
    key: "terres-ebre",
    label: "Terres de l'Ebre",
    // Baix Ebre, Montsià, Ribera, Terra Alta
    path: "M 90 240 L 105 260 L 105 305 L 155 335 L 130 365 L 65 350 L 40 300 L 55 245 Z",
    labelPos: [95, 315]
  }
];

// Espai de coordenades del mapa esquemàtic anterior.
// NOTA: si substitueixes aquest fitxer per la cartografia real de l'ICGC,
// canvia també aquest viewBox pel de la projecció generada.
window.VEGUERIA_VIEWBOX = "0 0 500 380";
