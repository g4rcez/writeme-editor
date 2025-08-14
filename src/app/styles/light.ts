import { defaultLightTheme } from "@g4rcez/components";

export const lightTheme: typeof defaultLightTheme = {
  ...defaultLightTheme,
  zIndex: { ...defaultLightTheme.zIndex, tooltip: "30" },
  spacing: {
    ...defaultLightTheme.spacing,
    sm: "0.875rem",
    lg: "1.125rem",
  },
  custom: { logo: "#112A40" },
  colors: {
    ...defaultLightTheme.colors,
    disabled: "hsla(225,11%,51%)",
    background: "hsla(208,30%,98.4%)",
    foreground: "hsla(208,22%,33%)",
    alert: {
      ...defaultLightTheme.colors.alert,
      danger: {
        text: "hsla(0,82%,35%)",
        border: "hsla(0,32%,75%)",
        bg: "hsla(357,90%,96%)",
      },
      success: {
        text: "hsla(152,86%,20%)",
        border: "hsla(140,30%,80%)",
        bg: "hsla(140,43%,96%)",
      },
    },
    danger: {
      ...defaultLightTheme.colors.danger,
      subtle: "hsla(0,69%,54%)",
      DEFAULT: "hsla(0,82%,38%)",
    },
    secondary: {
      ...defaultLightTheme.colors.secondary,
      foreground: "hsla(225,10%,53%)",
    },
    card: {
      ...defaultLightTheme.colors.card,
      background: "hsla(240,20%,100%)",
      border: "hsla(225,20%,93.6%)",
    },
    info: {
      ...defaultLightTheme.colors.info,
      DEFAULT: "hsla(199, 100%, 40%)",
    },
    tag: {
      ...defaultLightTheme.colors.tag,
      warn: { text: "hsla(23,100%,25%)", bg: "hsla(34,100%,86%)" },
      info: { bg: "hsla(203,38%,88%)", text: "hsla(202,40%,25%)" },
      muted: { bg: "hsla(203,40%,95%)", text: "hsla(202,35%,37%)" },
      danger: { bg: "hsla(12,100%,91%)", text: "hsla(10,82%,45%)" },
      primary: { bg: "hsla(208,100%,91%)", text: "hsla(208,32%,35%)" },
    },
    button: {
      ...defaultLightTheme.colors.button,
      warn: { text: "hsla(23,100%,25%)", bg: "hsla(34,100%,86%)" },
      info: { bg: "hsla(203,38%,88%)", text: "hsla(202,35%,27%)" },
      danger: { bg: "hsla(12,100%,91%)", text: "hsla(10,82%,45%)" },
      muted: { bg: "hsla(218,15%,95%)", text: "hsla(210,20%,42%)" },
      primary: { bg: "hsla(203,47%,31%)", text: "hsla(0,0%,100%)" },
    },
    emphasis: {
      ...defaultLightTheme.colors.emphasis,
      foreground: "hsla(0,0%,0%   )",
      subtle: "hsla(44,100%,65%)",
      hover: "hsla(44,100%,50%)",
      DEFAULT: "hsla(44,100%,55%)",
    },
    primary: {
      ...defaultLightTheme.colors.primary,
      subtle: "hsla(202,35%,37%)",
      hover: "hsla(202,35%,37%)",
      DEFAULT: "hsla(203,47%,31%)",
    },
    table: {
      background: "hsla(240,20%,100%)",
      header: "hsla(240,10%,98.4%)",
      border: "hsla(240,15%,95%)",
    },
    success: {
      DEFAULT: "hsla(160, 73%, 36%)",
      subtle: "hsla(160, 75%, 90%)",
      hover: "hsla(160, 91%, 27%)",
      foreground: "hsla(160, 91%, 90%)",
      notification: "hsla(160, 75%, 80%)",
    },
  },
};
