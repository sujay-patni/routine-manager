import { useColorScheme } from "react-native";

// Hex versions of the web app's OKLCH theme tokens (app/globals.css).
const light = {
  background: "#ffffff",
  foreground: "#020306",
  card: "#f9fafc",
  primary: "#0074ec",
  primaryForeground: "#ffffff",
  muted: "#e9ebee",
  mutedForeground: "#585b5f",
  accent: "#d8e7f5",
  accentForeground: "#002957",
  destructive: "#d81327",
  border: "#d6d7da",
  success: "#10b981",
  warning: "#d97706",
  warningBg: "#fef3c7",
  dangerBg: "#fef2f2",
  urgentBorder: "#fed7aa",
};

const dark: typeof light = {
  background: "#010203",
  foreground: "#f3f1f2",
  card: "#0b0e12",
  primary: "#008ffd",
  primaryForeground: "#010203",
  muted: "#161a1f",
  mutedForeground: "#8a8e93",
  accent: "#0a1c2c",
  accentForeground: "#76beff",
  destructive: "#f04c55",
  border: "#23272d",
  success: "#10b981",
  warning: "#fbbf24",
  warningBg: "#2a1f06",
  dangerBg: "#2a0b0e",
  urgentBorder: "#7c2d12",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export const radius = { sm: 8, md: 12, lg: 16, xl: 22 };
