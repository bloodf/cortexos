import { defineTheme } from "@astryxdesign/core/theme";

/**
 * CortexOS custom Astryx theme.
 *
 * Palette:
 *   - #1A1A1A  rich black background
 *   - #F0F0F0  off-white primary text
 *   - #004D61  dark teal accent 1
 *   - #822659  deep ruby accent 2
 *   - #3E5641  forest green button/CTA
 */
export const cortexTheme = defineTheme({
  name: "cortex",
  color: {
    accent: "#004D61",
    neutralStyle: "cool",
    contrast: "standard",
  },
  typography: {
    scale: { base: 14, ratio: 1.2 },
    body: {
      family: "Inter",
      fallbacks:
        "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Helvetica Neue, system-ui, sans-serif",
    },
    heading: {
      family: "Inter",
      fallbacks:
        "-apple-system, BlinkMacSystemFont, SF Pro Text, SF Pro Display, Helvetica Neue, system-ui, sans-serif",
    },
  },
  radius: { base: 8, multiplier: 1 },
  motion: { fast: 150, medium: 250, ratio: 0.8 },
  tokens: {
    // Dark mode overrides for the CortexOS palette
    "--color-background-body": ["#F1F4F7", "#1A1A1A"],
    "--color-background-surface": ["#FFFFFF", "#222222"],
    "--color-background-card": ["#FFFFFF", "#252525"],
    "--color-background-popover": ["#FFFFFF", "#2A2A2A"],
    "--color-background-muted": ["#0536590C", "#1F1F1F"],
    "--color-text-primary": ["#0A1317", "#F0F0F0"],
    "--color-text-secondary": ["#4E606F", "#A0A0A0"],
    "--color-text-accent": ["#0064E0", "#4A90A4"],
    "--color-icon-primary": ["#0A1317", "#F0F0F0"],
    "--color-icon-secondary": ["#4E606F", "#A0A0A0"],
    "--color-icon-accent": ["#0064E0", "#4A90A4"],
    "--color-border": ["#05365919", "#333333"],
    "--color-border-emphasized": ["#CCD3DB", "#444444"],
    "--color-accent": ["#0064E0", "#004D61"],
    "--color-accent-muted": ["#0082FB33", "#004D614D"],
    "--color-on-accent": ["#FFFFFF", "#F0F0F0"],
    "--color-track": ["#CCD3DB", "#333333"],
    "--color-skeleton": ["#CCD3DB", "#333333"],
    "--color-shadow": ["rgba(5, 54, 89, 0.1)", "rgba(0, 0, 0, 0.5)"],
    "--color-error": ["#E3193B", "#B03A5E"],
    "--color-error-muted": ["#E3193B33", "#8226594D"],
    "--color-success": ["#0D8626", "#3E5641"],
    "--color-success-muted": ["#0B991F33", "#3E56414D"],
  },
});
