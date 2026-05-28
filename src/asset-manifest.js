export const ASSET_MANIFEST = {
  version: 1,
  style: "warm-pixel-lowpoly",
  textureSize: 16,
  textureMode: "file-png-with-canvas-fallback",
  imageRoot: "./assets/textures",
  audioMode: "web-audio-synth",
  conventions: {
    textureName: "building-{type}-v{variant}.png",
    sourcePrompt: "assets/source/{type}.md",
  },
  textures: {
    residential: {
      path: "assets/textures/buildings/residential-v1.png",
      palette: ["#ffb8c9", "#ffe3ec", "#f68eaa", "#fff5d6"],
      tags: ["building", "home", "warm"],
    },
    commercial: {
      path: "assets/textures/buildings/commercial-v1.png",
      palette: ["#ffd36f", "#fff1a6", "#ffb85f", "#ffffff"],
      tags: ["building", "shop", "bright"],
    },
    industrial: {
      path: "assets/textures/buildings/industrial-v1.png",
      palette: ["#9fc0cf", "#d4e5ec", "#7899a7", "#f2f6f7"],
      tags: ["building", "work", "cool"],
    },
    park: {
      path: "assets/textures/buildings/park-v1.png",
      palette: ["#8ddf91", "#bff0a9", "#62b96c", "#ffd0dd"],
      tags: ["service", "nature"],
    },
    school: {
      path: "assets/textures/buildings/school-v1.png",
      palette: ["#ffc36e", "#ffe0a6", "#f09b50", "#ffffff"],
      tags: ["service", "education"],
    },
    fire: {
      path: "assets/textures/buildings/fire-v1.png",
      palette: ["#ff8b7f", "#ffd0ca", "#e65f5d", "#ffffff"],
      tags: ["service", "safety"],
    },
    power: {
      path: "assets/textures/buildings/power-v1.png",
      palette: ["#ffe47a", "#fff3b8", "#f1b84b", "#ffffff"],
      tags: ["utility", "energy"],
    },
    water: {
      path: "assets/textures/buildings/water-v1.png",
      palette: ["#84c9ff", "#d5f2ff", "#5aaee7", "#ffffff"],
      tags: ["utility", "water"],
    },
    plaza: {
      path: "assets/textures/landmarks/plaza-v1.png",
      palette: ["#f6d58b", "#fff0bf", "#8bcf9a", "#ffffff"],
      tags: ["landmark", "culture"],
    },
    station: {
      path: "assets/textures/landmarks/station-v1.png",
      palette: ["#b9d8f2", "#fff4c0", "#5d8ca8", "#ffffff"],
      tags: ["landmark", "transport"],
    },
    lantern: {
      path: "assets/textures/landmarks/lantern-v1.png",
      palette: ["#ffb1a6", "#ffe0ba", "#e95f64", "#ffffff"],
      tags: ["landmark", "festival"],
    },
  },
  audioCues: {
    ui: [{ frequency: 520, duration: 0.07, type: "triangle", gain: 0.08 }],
    build: [{ frequency: 420, duration: 0.1, type: "triangle", gain: 0.12, slide: 80 }],
    road: [{ frequency: 300, duration: 0.09, type: "square", gain: 0.08, slide: 40 }],
    demolish: [{ frequency: 170, duration: 0.12, type: "sawtooth", gain: 0.1, slide: -60 }],
    upgrade: [
      { frequency: 540, duration: 0.08, type: "triangle", gain: 0.09 },
      { frequency: 720, duration: 0.12, type: "sine", gain: 0.08 },
    ],
    report: [{ frequency: 660, duration: 0.1, type: "sine", gain: 0.06 }],
    chapter: [
      { frequency: 520, duration: 0.1, type: "triangle", gain: 0.1 },
      { frequency: 780, duration: 0.16, type: "sine", gain: 0.09 },
    ],
    warning: [{ frequency: 220, duration: 0.16, type: "sawtooth", gain: 0.08, slide: -90 }],
  },
  musicLoop: {
    tempoMs: 620,
    gain: 0.035,
    notes: [392, 494, 523, 659, 587, 523, 494, 440],
    bass: [196, 196, 220, 247],
  },
};

export function assetManifestSummary() {
  return {
    version: ASSET_MANIFEST.version,
    style: ASSET_MANIFEST.style,
    textureMode: ASSET_MANIFEST.textureMode,
    audioMode: ASSET_MANIFEST.audioMode,
    textureCount: Object.keys(ASSET_MANIFEST.textures).length,
    audioCueCount: Object.keys(ASSET_MANIFEST.audioCues).length,
    musicNoteCount: ASSET_MANIFEST.musicLoop.notes.length,
  };
}
