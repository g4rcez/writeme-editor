import { defaultDarkTheme } from "@g4rcez/components";

export const catppuccinMochaTheme: typeof defaultDarkTheme = {
  ...defaultDarkTheme,
  spacing: { ...defaultDarkTheme.spacing, sm: "0.875rem", lg: "1.125rem" },
  zIndex: { ...defaultDarkTheme.zIndex, tooltip: "30" },
  colors: {
    ...defaultDarkTheme.colors,
    background: "hsla(240, 21%, 15%)",
    foreground: "hsla(226, 64%, 88%)",
    border: "hsla(234, 13%, 31%)",
    disabled: "hsla(231, 11%, 47%)",
    emphasis: {
      foreground: "hsla(240, 24%, 9%)",
      DEFAULT: "hsla(23, 92%, 75%)",
      subtle: "hsla(23, 50%, 20%)",
      hover: "hsla(23, 92%, 65%)",
    },
    primary: {
      foreground: "hsla(240, 24%, 9%)",
      DEFAULT: "hsla(267, 84%, 81%)",
      subtle: "hsla(267, 50%, 20%)",
      hover: "hsla(267, 84%, 76%)",
    },
    secondary: {
      foreground: "hsla(240, 24%, 9%)",
      DEFAULT: "hsla(217, 92%, 76%)",
      subtle: "hsla(217, 50%, 20%)",
      hover: "hsla(217, 92%, 70%)",
      background: "hsla(217, 40%, 20%)",
    },
    info: {
      DEFAULT: "hsla(199, 76%, 69%)",
      subtle: "hsla(199, 50%, 15%)",
      hover: "hsla(199, 76%, 60%)",
      foreground: "hsla(240, 24%, 9%)",
      notification: "hsla(199, 76%, 69%)",
    },
    warn: {
      DEFAULT: "hsla(41, 86%, 83%)",
      subtle: "hsla(41, 50%, 20%)",
      hover: "hsla(41, 86%, 73%)",
      foreground: "hsla(240, 24%, 9%)",
      notification: "hsla(41, 86%, 83%)",
    },
    danger: {
      DEFAULT: "hsla(343, 81%, 75%)",
      subtle: "hsla(343, 50%, 20%)",
      hover: "hsla(343, 81%, 65%)",
      foreground: "hsla(240, 24%, 9%)",
      notification: "hsla(343, 81%, 75%)",
    },
    success: {
      DEFAULT: "hsla(115, 54%, 76%)",
      subtle: "hsla(115, 30%, 20%)",
      hover: "hsla(115, 54%, 66%)",
      foreground: "hsla(240, 24%, 9%)",
      notification: "hsla(115, 54%, 76%)",
    },
    input: {
      border: "hsla(233, 12%, 39%)",
      placeholder: "hsla(230, 13%, 55%)",
      "mask-error": "hsla(343, 81%, 75%)",
      "switch-bg": "hsla(237, 16%, 23%)",
      switch: "hsla(0, 0%, 100%)",
      slider: "hsla(0, 0%, 100%)",
    },
    card: {
      muted: "hsla(237, 16%, 23%)",
      border: "hsla(237, 16%, 23%)",
      background: "hsla(240, 21%, 12%)",
    },
    floating: {
      foreground: "hsla(226, 64%, 88%)",
      background: "hsla(237, 16%, 23%)",
      hover: "hsla(234, 13%, 31%)",
      border: "hsla(234, 13%, 31%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    tooltip: {
      foreground: "hsla(226, 64%, 88%)",
      background: "hsla(240, 24%, 9%)",
      hover: "hsla(237, 16%, 23%)",
      border: "hsla(237, 16%, 23%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    table: {
      background: "hsla(240, 21%, 12%)",
      header: "hsla(237, 16%, 23%)",
      border: "hsla(237, 16%, 23%)",
    },
    button: {
      primary: {
        bg: "hsla(267, 84%, 81%)",
        text: "hsla(240, 24%, 9%)",
      },
      warn: {
        text: "hsla(240, 24%, 9%)",
        bg: "hsla(41, 86%, 83%)",
      },
      info: {
        bg: "hsla(199, 76%, 69%)",
        text: "hsla(240, 24%, 9%)",
      },
      success: {
        text: "hsla(240, 24%, 9%)",
        bg: "hsla(115, 54%, 76%)",
      },
      danger: {
        bg: "hsla(343, 81%, 75%)",
        text: "hsla(240, 24%, 9%)",
      },
      muted: {
        text: "hsla(226, 64%, 88%)",
        bg: "hsla(234, 13%, 31%)",
      },
      neutral: {
        text: "hsla(217, 92%, 76%)",
        bg: "hsla(237, 16%, 23%)",
      },
      secondary: {
        text: "hsla(217, 92%, 76%)",
        bg: "hsla(217, 40%, 20%)",
      },
    },
  },
};
