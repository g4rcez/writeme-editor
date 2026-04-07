import { defaultDarkTheme } from "@g4rcez/components";

export const tokyonightNightTheme: typeof defaultDarkTheme = {
  ...defaultDarkTheme,
  spacing: { ...defaultDarkTheme.spacing, sm: "0.875rem", lg: "1.125rem" },
  zIndex: { ...defaultDarkTheme.zIndex, tooltip: "30" },
  colors: {
    ...defaultDarkTheme.colors,
    background: "hsla(230, 24%, 19%)",
    foreground: "hsla(229, 73%, 86%)",
    border: "hsla(229, 23%, 33%)",
    disabled: "hsla(229, 23%, 44%)",
    emphasis: {
      foreground: "hsla(229, 26%, 16%)",
      DEFAULT: "hsla(23, 100%, 70%)",
      subtle: "hsla(23, 50%, 20%)",
      hover: "hsla(23, 100%, 60%)",
    },
    primary: {
      foreground: "hsla(229, 26%, 16%)",
      DEFAULT: "hsla(261, 86%, 79%)",
      subtle: "hsla(261, 50%, 20%)",
      hover: "hsla(261, 86%, 74%)",
    },
    secondary: {
      foreground: "hsla(229, 26%, 16%)",
      DEFAULT: "hsla(221, 89%, 72%)",
      subtle: "hsla(221, 50%, 20%)",
      hover: "hsla(221, 89%, 66%)",
      background: "hsla(221, 40%, 20%)",
    },
    info: {
      DEFAULT: "hsla(202, 100%, 75%)",
      subtle: "hsla(202, 50%, 15%)",
      hover: "hsla(202, 100%, 65%)",
      foreground: "hsla(229, 26%, 16%)",
      notification: "hsla(202, 100%, 75%)",
    },
    warn: {
      DEFAULT: "hsla(35, 66%, 64%)",
      subtle: "hsla(35, 50%, 20%)",
      hover: "hsla(35, 66%, 54%)",
      foreground: "hsla(229, 26%, 16%)",
      notification: "hsla(35, 66%, 64%)",
    },
    danger: {
      DEFAULT: "hsla(349, 89%, 72%)",
      subtle: "hsla(349, 50%, 20%)",
      hover: "hsla(349, 89%, 62%)",
      foreground: "hsla(229, 26%, 16%)",
      notification: "hsla(349, 89%, 72%)",
    },
    success: {
      DEFAULT: "hsla(89, 51%, 61%)",
      subtle: "hsla(89, 30%, 20%)",
      hover: "hsla(89, 51%, 51%)",
      foreground: "hsla(229, 26%, 16%)",
      notification: "hsla(89, 51%, 61%)",
    },
    input: {
      border: "hsla(229, 23%, 33%)",
      placeholder: "hsla(229, 23%, 44%)",
      "mask-error": "hsla(349, 89%, 72%)",
      "switch-bg": "hsla(228, 23%, 21%)",
      switch: "hsla(0, 0%, 100%)",
      slider: "hsla(0, 0%, 100%)",
    },
    card: {
      muted: "hsla(228, 23%, 21%)",
      border: "hsla(228, 23%, 21%)",
      background: "hsla(229, 26%, 16%)",
    },
    floating: {
      foreground: "hsla(229, 73%, 86%)",
      background: "hsla(228, 23%, 21%)",
      hover: "hsla(229, 23%, 33%)",
      border: "hsla(229, 23%, 33%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    tooltip: {
      foreground: "hsla(229, 73%, 86%)",
      background: "hsla(229, 26%, 16%)",
      hover: "hsla(228, 23%, 21%)",
      border: "hsla(228, 23%, 21%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    table: {
      background: "hsla(229, 26%, 16%)",
      header: "hsla(228, 23%, 21%)",
      border: "hsla(228, 23%, 21%)",
    },
    button: {
      primary: {
        bg: "hsla(261, 86%, 79%)",
        text: "hsla(229, 26%, 16%)",
      },
      warn: {
        text: "hsla(229, 26%, 16%)",
        bg: "hsla(35, 66%, 64%)",
      },
      info: {
        bg: "hsla(202, 100%, 75%)",
        text: "hsla(229, 26%, 16%)",
      },
      success: {
        text: "hsla(229, 26%, 16%)",
        bg: "hsla(89, 51%, 61%)",
      },
      danger: {
        bg: "hsla(349, 89%, 72%)",
        text: "hsla(229, 26%, 16%)",
      },
      muted: {
        text: "hsla(229, 73%, 86%)",
        bg: "hsla(229, 23%, 33%)",
      },
      neutral: {
        text: "hsla(221, 89%, 72%)",
        bg: "hsla(228, 23%, 21%)",
      },
      secondary: {
        text: "hsla(221, 89%, 72%)",
        bg: "hsla(221, 40%, 20%)",
      },
    },
  },
};
