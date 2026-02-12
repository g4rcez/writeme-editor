import { defaultLightTheme } from "@g4rcez/components";

export const lightTheme: typeof defaultLightTheme = {
  ...defaultLightTheme,
  zIndex: { ...defaultLightTheme.zIndex, tooltip: "30" },
  spacing: {
    ...defaultLightTheme.spacing,
    sm: "0.875rem",
    lg: "1.125rem",
  },
  colors: {
    foreground: "hsla(220, 30%, 15%)",
    background: "hsla(220, 20%, 98%)",
    border: "hsla(220, 15%, 85%)",
    muted: "hsla(220, 10%, 90%)",
    disabled: "hsla(220, 10%, 60%)",
    emphasis: {
      foreground: "hsla(220, 30%, 10%)",
      DEFAULT: "hsla(35, 100%, 55%)",
      subtle: "hsla(35, 100%, 85%)",
      hover: "hsla(35, 100%, 45%)",
    },
    primary: {
      foreground: "hsla(220, 20%, 98%)",
      DEFAULT: "hsla(215, 100%, 35%)",
      subtle: "hsla(215, 100%, 90%)",
      hover: "hsla(215, 100%, 25%)",
    },
    secondary: {
      background: "hsla(195, 80%, 30%)",
      DEFAULT: "hsla(195, 100%, 30%)",
      subtle: "hsla(195, 50%, 90%)",
      hover: "hsla(195, 100%, 25%)",
      foreground: "hsla(220, 20%, 98%)",
    },
    info: {
      DEFAULT: "hsla(185, 90%, 40%)",
      subtle: "hsla(185, 50%, 90%)",
      hover: "hsla(185, 90%, 30%)",
      foreground: "hsla(220, 20%, 98%)",
      notification: "hsla(185, 90%, 40%)",
    },
    danger: {
      DEFAULT: "hsla(0, 80%, 50%)",
      subtle: "hsla(0, 50%, 90%)",
      hover: "hsla(0, 80%, 40%)",
      foreground: "hsla(220, 20%, 98%)",
      notification: "hsla(0, 80%, 50%)",
    },
    warn: {
      DEFAULT: "hsla(45, 100%, 45%)",
      subtle: "hsla(45, 50%, 90%)",
      hover: "hsla(45, 100%, 35%)",
      foreground: "hsla(220, 30%, 10%)",
      notification: "hsla(45, 100%, 45%)",
    },
    success: {
      DEFAULT: "hsla(150, 80%, 35%)",
      subtle: "hsla(150, 50%, 90%)",
      hover: "hsla(150, 80%, 25%)",
      foreground: "hsla(220, 20%, 98%)",
      notification: "hsla(150, 80%, 35%)",
    },
    input: {
      border: "hsla(220, 15%, 85%)",
      placeholder: "hsla(220, 10%, 60%)",
      "mask-error": "hsla(0, 80%, 70%)",
      "switch-bg": "hsla(220, 10%, 80%)",
      switch: "hsla(0, 0%, 100%)",
      slider: "hsla(0, 0%, 100%)",
    },
    card: {
      muted: "hsla(220, 10%, 96%)",
      border: "hsla(220, 15%, 90%)",
      background: "hsla(220, 10%, 99.5%)",
    },
    floating: {
      foreground: "hsla(220, 30%, 15%)",
      background: "hsla(0, 0%, 100%)",
      hover: "hsla(220, 10%, 96%)",
      border: "hsla(220, 15%, 90%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    tooltip: {
      foreground: "hsla(220, 30%, 15%)",
      background: "hsla(220, 20%, 98%)",
      hover: "hsla(220, 20%, 94%)",
      border: "hsla(220, 15%, 90%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    table: {
      background: "hsla(240,20%,100%)",
      header: "hsla(220,10%,98.4%)",
      border: "hsla(240,15%,95%)",
    },
    button: {
      muted: {
        bg: "hsla(220, 10%, 92%)",
        text: "hsla(220, 20%, 40%)",
      },
      primary: {
        bg: "hsla(215, 100%, 35%)",
        text: "hsla(220, 20%, 98%)",
      },
      warn: {
        text: "hsla(220, 30%, 10%)",
        bg: "hsla(45, 100%, 45%)",
      },
      info: {
        bg: "hsla(185, 90%, 40%)",
        text: "hsla(220, 20%, 98%)",
      },
      success: {
        text: "hsla(220, 20%, 98%)",
        bg: "hsla(150, 80%, 35%)",
      },
      danger: {
        bg: "hsla(0, 80%, 50%)",
        text: "hsla(220, 20%, 98%)",
      },
      neutral: {
        text: "hsla(200,98%,60%)",
        bg: "hsla(200,28%,19%)",
      },
      secondary: {
        text: "hsla(220, 20%, 98%)",
        bg: "hsla(195, 100%, 30%)",
      },
    },
    tag: {
      muted: {
        bg: "hsla(220, 10%, 92%)",
        text: "hsla(220, 20%, 40%)",
      },
      primary: {
        bg: "hsla(215, 100%, 90%)",
        text: "hsla(215, 100%, 30%)",
      },
      warn: {
        text: "hsla(45, 100%, 30%)",
        bg: "hsla(45, 100%, 90%)",
      },
      info: {
        bg: "hsla(185, 50%, 92%)",
        text: "hsla(185, 92%, 37%)",
      },
      success: {
        text: "hsla(150, 80%, 25%)",
        bg: "hsla(150, 50%, 90%)",
      },
      danger: {
        bg: "hsla(0, 80%, 90%)",
        text: "hsla(0, 80%, 40%)",
      },
      neutral: {
        text: "hsla(200,98%,60%)",
        bg: "hsla(200,28%,19%)",
        border: "hsla(200,90%,89%)",
      },
      secondary: {
        text: "hsla(195, 100%, 30%)",
        bg: "hsla(195, 50%, 90%)",
      },
    },
    alert: {
      muted: {
        bg: "hsla(220, 10%, 96%)",
        text: "hsla(220, 20%, 40%)",
        border: "hsla(220, 15%, 85%)",
      },
      primary: {
        text: "hsla(215, 100%, 30%)",
        border: "hsla(215, 50%, 80%)",
        bg: "hsla(215, 100%, 97%)",
      },
      warn: {
        bg: "hsla(45, 100%, 96%)",
        text: "hsla(45, 100%, 35%)",
        border: "hsla(45, 100%, 80%)",
      },
      info: {
        text: "hsla(185, 90%, 40%)",
        bg: "hsla(185, 100%, 98%)",
        border: "hsla(185, 80%, 80%)",
      },
      success: {
        text: "hsla(160, 84%, 29%)",
        border: "hsla(158, 64%, 90%)",
        bg: "hsla(160, 100%, 96%)",
      },
      danger: {
        text: "hsla(0, 84%, 45%)",
        border: "hsla(0, 93%, 54%)",
        bg: "hsla(0, 100%, 96%)",
      },
      neutral: {
        text: "hsla(200,98%,60%)",
        bg: "hsla(200,28%,19%)",
        border: "hsla(200,90%,89%)",
      },
      secondary: {
        text: "hsla(216,10%,10%)",
        bg: "hsla(214,7%,92%)",
        border: "hsla(216,22%,78%)",
      },
    },
  },
};
