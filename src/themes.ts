export type SceneKind =
  | "vault"
  | "constellation"
  | "waves"
  | "crystals"
  | "orbits"
  | "skyline";

export interface Theme {
  id: string;
  ar: string;
  en: string;
  scene: SceneKind;
  /** 3D scene palette. */
  primary: string;
  secondary: string;
  tokens: {
    bg: string;
    "bg-2": string;
    accent: string;
    "accent-strong": string;
    "accent-deep": string;
    "accent-ink": string;
    "orb-a": string;
    "orb-b": string;
    "orb-c": string;
    "tint-rgb": string;
  };
}

export const THEMES: Theme[] = [
  {
    id: "aurum",
    ar: "ذهب ملكي",
    en: "Royal Gold",
    scene: "vault",
    primary: "#e6c67e",
    secondary: "#9c7433",
    tokens: {
      bg: "#090705",
      "bg-2": "#17120b",
      accent: "#e8c987",
      "accent-strong": "#f8e6b6",
      "accent-deep": "#9c7433",
      "accent-ink": "#1a1205",
      "orb-a": "#7a5719",
      "orb-b": "#3d2a0e",
      "orb-c": "#5c4315",
      "tint-rgb": "232, 201, 135",
    },
  },
  {
    id: "midnight",
    ar: "ياقوت أزرق",
    en: "Midnight Sapphire",
    scene: "constellation",
    primary: "#8fbaff",
    secondary: "#4d6dff",
    tokens: {
      bg: "#050916",
      "bg-2": "#0c1430",
      accent: "#8fbaff",
      "accent-strong": "#d4e4ff",
      "accent-deep": "#3f5fe0",
      "accent-ink": "#050b22",
      "orb-a": "#1e3f94",
      "orb-b": "#16306b",
      "orb-c": "#39308a",
      "tint-rgb": "143, 186, 255",
    },
  },
  {
    id: "emerald",
    ar: "زمرد إمبراطوري",
    en: "Imperial Emerald",
    scene: "waves",
    primary: "#5fe3b4",
    secondary: "#1c9a78",
    tokens: {
      bg: "#03100c",
      "bg-2": "#08201a",
      accent: "#6ee8bd",
      "accent-strong": "#c8f7e6",
      "accent-deep": "#178063",
      "accent-ink": "#02160f",
      "orb-a": "#0f6b52",
      "orb-b": "#0b4a4a",
      "orb-c": "#3c6a2e",
      "tint-rgb": "110, 232, 189",
    },
  },
  {
    id: "amethyst",
    ar: "جمشت ملكي",
    en: "Royal Amethyst",
    scene: "crystals",
    primary: "#c6a2ff",
    secondary: "#7b4fe0",
    tokens: {
      bg: "#0c0717",
      "bg-2": "#1a1030",
      accent: "#c9a8ff",
      "accent-strong": "#ecdfff",
      "accent-deep": "#7446d8",
      "accent-ink": "#120724",
      "orb-a": "#5a2fa8",
      "orb-b": "#3b2a8c",
      "orb-c": "#83356f",
      "tint-rgb": "201, 168, 255",
    },
  },
  {
    id: "rose",
    ar: "ذهب وردي",
    en: "Rose Gold",
    scene: "orbits",
    primary: "#f4b8a8",
    secondary: "#b86a62",
    tokens: {
      bg: "#110809",
      "bg-2": "#241114",
      accent: "#f6bfae",
      "accent-strong": "#fde3da",
      "accent-deep": "#ae5f58",
      "accent-ink": "#220c0a",
      "orb-a": "#8c3d3f",
      "orb-b": "#5b2636",
      "orb-c": "#8a5a32",
      "tint-rgb": "246, 191, 174",
    },
  },
  {
    id: "platinum",
    ar: "بلاتين أسود",
    en: "Black Platinum",
    scene: "skyline",
    primary: "#dbe6f0",
    secondary: "#7d8fa3",
    tokens: {
      bg: "#07090c",
      "bg-2": "#12161c",
      accent: "#dfe8f1",
      "accent-strong": "#ffffff",
      "accent-deep": "#7a8a9c",
      "accent-ink": "#0a0d11",
      "orb-a": "#3b4a5c",
      "orb-b": "#262f3b",
      "orb-c": "#4a4f5c",
      "tint-rgb": "223, 232, 241",
    },
  },
];

const THEME_KEY = "gp-theme";
const MOTION_KEY = "gp-motion";
const CHANGE_EVENT = "gp-appearance";

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function currentTheme(): Theme {
  const id = stored(THEME_KEY) ?? THEMES[0].id;
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export function motionEnabled(): boolean {
  return (
    stored(MOTION_KEY) !== "off" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function paint(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  for (const [token, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--${token}`, value);
  }
}

export function setTheme(id: string): void {
  localStorage.setItem(THEME_KEY, id);
  paint(currentTheme());
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function setMotion(enabled: boolean): void {
  localStorage.setItem(MOTION_KEY, enabled ? "on" : "off");
  document.documentElement.dataset.motion = enabled ? "on" : "off";
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onAppearanceChange(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

export function initAppearance(): void {
  paint(currentTheme());
  document.documentElement.dataset.motion = stored(MOTION_KEY) === "off" ? "off" : "on";
}
