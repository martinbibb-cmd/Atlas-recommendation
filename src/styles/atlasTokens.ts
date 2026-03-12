/**
 * atlasTokens.ts
 *
 * Atlas design-token constants as TypeScript values.
 *
 * Use these when a component needs to reference a token inside an inline
 * style expression (e.g. dynamic colours driven by JS state).  Prefer the
 * CSS custom properties in tokens.css for everything that can be expressed
 * as a static CSS class.
 */

export const atlasColors = {
  atlasBlue: "#2F6BFF",
  atlasDark: "#1C2430",

  background:   "#F6F8FB",
  surface:      "#FFFFFF",
  surfaceFocus: "rgba(255,255,255,0.78)",

  divider: "#E3E7EE",

  success: "#28C76F",
  warning: "#FFB020",
  danger:  "#EA5455",

  textPrimary:   "#1C2430",
  textSecondary: "#667085",
}

export const atlasRadius = {
  panel: "14px",
  card:  "10px",
  small: "6px",
}

export const atlasSpacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
}

export const atlasShadows = {
  soft:  "0 4px 10px rgba(0,0,0,0.05)",
  panel: "0 6px 18px rgba(0,0,0,0.08)",
}
