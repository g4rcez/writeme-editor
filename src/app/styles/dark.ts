import { defaultDarkTheme } from "@g4rcez/components";

export const darkTheme: typeof defaultDarkTheme = {
  ...defaultDarkTheme,
  spacing: { ...defaultDarkTheme.spacing, sm: "0.875rem", lg: "1.125rem" },
  zIndex: { ...defaultDarkTheme.zIndex, tooltip: "30" },
  colors: {
  ...defaultDarkTheme.colors,
    foreground: "hsla(220, 20%, 96%)",
    background: "hsla(221, 12%, 9%)",
    border: "hsla(220, 10%, 25%)",
    disabled: "hsla(220, 5%, 40%)",
    emphasis: {
      foreground: "hsla(220, 30%, 10%)",
      DEFAULT: "hsla(35, 100%, 70%)",
      subtle: "hsla(35, 100%, 20%)",
      hover: "hsla(35, 100%, 60%)",
    },
    primary: {
      foreground: "hsla(220, 30%, 10%)",
      DEFAULT: "hsla(215, 100%, 70%)",
      subtle: "hsla(215, 100%, 20%)",
      hover: "hsla(215, 100%, 65%)",
    },
    secondary: {
      foreground: "hsla(220, 30%, 10%)",
      DEFAULT: "hsla(195, 87%, 70%)",
      subtle: "hsla(195, 100%, 20%)",
      hover: "hsla(195, 100%, 65%)",
      background: "hsla(195, 40%, 20%)",
    },
    info: {
      DEFAULT: "hsla(185, 90%, 65%)",
      subtle: "hsla(185, 100%, 15%)",
      hover: "hsla(185, 90%, 55%)",
      foreground: "hsla(220, 30%, 10%)",
      notification: "hsla(185, 90%, 65%)",
    },
    warn: {
      DEFAULT: "hsla(45, 100%, 60%)",
      subtle: "hsla(45, 50%, 20%)",
      hover: "hsla(45, 100%, 55%)",
      foreground: "hsla(45, 10%, 10%)",
      notification: "hsla(45, 100%, 60%)",
    },
    danger: {
      DEFAULT: "hsla(0, 85%, 65%)",
      subtle: "hsla(0, 50%, 20%)",
      hover: "hsla(0, 85%, 60%)",
      foreground: "hsla(220, 30%, 10%)",
      notification: "hsla(0, 85%, 65%)",
    },
    success: {
      DEFAULT: "hsla(150, 80%, 45%)",
      subtle: "hsla(150, 50%, 20%)",
      hover: "hsla(150, 80%, 40%)",
      foreground: "hsla(220, 30%, 10%)",
      notification: "hsla(150, 80%, 45%)",
    },
    input: {
      border: "hsla(220, 10%, 30%)",
      placeholder: "hsla(220, 10%, 50%)",
      "mask-error": "hsla(0, 94%, 81%)",
      "switch-bg": "hsla(220, 10%, 20%)",
      switch: "hsla(0, 0%, 100%)",
      slider: "hsla(0, 0%, 100%)",
    },
    card: {
      muted: "hsla(220, 10%, 14%)",
      border: "hsla(220, 10%, 15%)",
      background: "hsla(221, 7%, 10%)",
    },
    floating: {
      foreground: "hsla(220, 20%, 96%)",
      background: "hsla(220, 10%, 12%)",
      hover: "hsla(220, 10%, 15%)",
      border: "hsla(220, 10%, 14%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    tooltip: {
      foreground: "hsla(220, 20%, 96%)",
      background: "hsla(220, 10%, 8%)",
      hover: "hsla(220, 10%, 15%)",
      border: "hsla(220, 10%, 12%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    table: {
      background: "hsla(220, 10%, 9%)",
      header: "hsla(220, 10%, 11%)",
      border: "hsla(220, 10%, 18%)",
    },
    button: {
      primary: {
        bg: "hsla(215, 100%, 70%)",
        text: "hsla(220, 30%, 10%)",
      },
      warn: {
        text: "hsla(45, 10%, 10%)",
        bg: "hsla(45, 100%, 60%)",
      },
      info: {
        bg: "hsla(185, 90%, 65%)",
        text: "hsla(220, 30%, 10%)",
      },
      success: {
        text: "hsla(220, 30%, 10%)",
        bg: "hsla(150, 80%, 45%)",
      },
      danger: {
        bg: "hsla(0, 85%, 65%)",
        text: "hsla(220, 30%, 10%)",
      },
      muted: {
        text: "hsla(220, 20%, 80%)",
        bg: "hsla(220, 10%, 25%)",
      },
      neutral: {
        text: "hsla(194,98%,50%)",
        bg: "hsla(200,28%,89%)",
      },
      secondary: {
        text: "hsla(200,98%,60%)",
        bg: "hsla(200,28%,19%)",
      },
    },
  },
};
