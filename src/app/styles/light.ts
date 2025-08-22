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
    foreground: "hsla(208,50%,23%)",
    background: "hsla(208,30%,98.4%)",
    border: "hsla(210, 25%, 88%)",
    muted: "hsla(210, 30%, 86%)",
    disabled: "hsla(225,11%,51%)",
    emphasis: {
      foreground: "hsla(0,0%,0%   )",
      DEFAULT: "hsla(44,100%,55%)",
      subtle: "hsla(44,100%,65%)",
      hover: "hsla(44,100%,50%)",
    },
    primary: {
      foreground: "hsla(210, 40%, 98%)",
      DEFAULT: "hsla(200, 98%, 39%)",
      subtle: "hsla(200, 94%, 85%)",
      hover: "hsla(200, 98%, 30%)",
    },
    secondary: {
      background: "hsla(210, 25%, 35%)",
      DEFAULT: "hsla(210, 25%, 45%)",
      subtle: "hsla(207, 29%, 39%)",
      hover: "hsla(210, 21%, 67%)",
      foreground: "hsla(225,10%,53%)",
    },
    info: {
      DEFAULT: "hsla(263, 70%, 50%)",
      subtle: "hsla(263, 100%, 95%)",
      hover: "hsla(263, 70%, 40%)",
      foreground: "hsla(210, 34%, 96%)",
      notification: "hsla(263, 70%, 50%)",
    },
    danger: {
      DEFAULT: "hsla(0, 84%, 45%)",
      subtle: "hsla(0, 93%, 94%)",
      hover: "hsla(0, 84%, 35%)",
      foreground: "hsla(210, 34%, 96%)",
      notification: "hsla(0, 84%, 45%)",
    },
    warn: {
      DEFAULT: "hsla(45, 93%, 47%)",
      subtle: "hsla(48, 100%, 88%)",
      hover: "hsla(43, 96%, 37%)",
      foreground: "hsla(45, 5%, 11%)",
      notification: "hsla(45, 93%, 47%)",
    },
    success: {
      DEFAULT: "hsla(160, 84%, 39%)",
      subtle: "hsla(158, 64%, 90%)",
      hover: "hsla(160, 84%, 29%)",
      foreground: "hsla(210, 34%, 96%)",
      notification: "hsla(160, 84%, 39%)",
    },
    input: {
      border: "hsla(218, 22%, 85%)",
      placeholder: "hsla(210, 24%, 71%)",
      "mask-error": "hsla(0, 94%, 81%)",
      "switch-bg": "hsla(0, 0%, 45%)",
      switch: "hsla(0, 0%, 100%)",
      slider: "hsla(0, 0%, 100%)",
    },
    card: {
      muted: "hsla(210, 25%, 94%)",
      border: "hsla(225,20%,93.6%)",
      background: "hsla(240,20%,100%)",
    },
    floating: {
      foreground: "hsla(217, 15%, 20%)",
      background: "hsla(0, 0%, 100%)",
      hover: "hsla(0, 0%, 92%)",
      border: "hsla(210, 25%, 88%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    tooltip: {
      foreground: "hsla(217, 15%, 20%)",
      background: "hsla(210, 25%, 98%)",
      hover: "hsla(210, 25%, 92%)",
      border: "hsla(200, 1%, 80%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    table: {
      background: "hsla(240,20%,100%)",
      header: "hsla(240,10%,98.4%)",
      border: "hsla(240,15%,95%)",
    },
    button: {
      muted: {
        bg: "hsla(218,15%,95%)",
        text: "hsla(210,20%,42%)",
      },
      primary: {
        bg: "hsla(200, 98%, 39%)",
        text: "hsla(210, 40%, 98%)",
      },
      warn: {
        text: "hsla(45, 5%, 11%)",
        bg: "hsla(45, 93%, 47%)",
      },
      info: {
        bg: "hsla(263, 70%, 50%)",
        text: "hsla(210, 34%, 96%)",
      },
      success: {
        text: "hsla(210, 34%, 96%)",
        bg: "hsla(160, 84%, 39%)",
      },
      danger: {
        bg: "hsla(0, 84%, 45%)",
        text: "hsla(210, 34%, 96%)",
      },
      neutral: {
        text: "hsla(200,98%,60%)",
        bg: "hsla(200,28%,19%)",
      },
      secondary: {
        text: "hsla(216,10%,90%)",
        bg: "hsla(214,7%,19%)",
      },
    },
    tag: {
      muted: {
        bg: "hsla(203,40%,95%)",
        text: "hsla(202,35%,37%)",
      },
      primary: {
        bg: "hsla(200, 94%, 85%)",
        text: "hsla(200, 98%, 39%)",
      },
      warn: {
        text: "hsla(45, 5%, 11%)",
        bg: "hsla(45, 93%, 47%)",
      },
      info: {
        bg: "hsla(263, 100%, 95%)",
        text: "hsla(263, 70%, 50%)",
      },
      success: {
        text: "hsla(160, 84%, 29%)",
        bg: "hsla(158, 64%, 90%)",
      },
      danger: {
        bg: "hsla(0, 93%, 94%)",
        text: "hsla(0, 84%, 45%)",
      },
      neutral: {
        text: "hsla(200,98%,60%)",
        bg: "hsla(200,28%,19%)",
      },
      secondary: {
        text: "hsla(216,10%,90%)",
        bg: "hsla(214,7%,19%)",
      },
    },
    alert: {
      muted: {
        bg: "hsla(210, 30%, 86%)",
        text: "hsla(210, 30%, 86%)",
        border: "hsla(210, 10%, 70%)",
      },
      primary: {
        text: "hsla(200, 98%, 39%)",
        border: "hsla(200, 94%, 85%)",
        bg: "hsla(200, 100%, 96%)",
      },
      warn: {
        bg: "hsla(48, 100%, 96%)",
        text: "hsla(45, 93%, 47%)",
        border: "hsla(48, 100%, 88%)",
      },
      info: {
        text: "hsla(263, 70%, 50%)",
        bg: "hsla(263, 100%, 96%)",
        border: "hsla(263, 100%, 45%)",
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
