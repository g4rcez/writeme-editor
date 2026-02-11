import { defaultDarkTheme } from "@g4rcez/components";

export const darkTheme: typeof defaultDarkTheme = {
  ...defaultDarkTheme,
  spacing: { ...defaultDarkTheme.spacing, sm: "0.875rem", lg: "1.125rem" },
  zIndex: { ...defaultDarkTheme.zIndex, tooltip: "30" },
  colors: {
    foreground: "hsla(221,6%,95%)",
    background: "hsla(221,12%,9%)",
    border: "hsla(225, 10%, 30%)",
    muted: "hsla(221, 12%, 28%)",
    disabled: "hsla(202,18%,55%)",
    emphasis: {
      foreground: "hsla(251, 91%, 95%)",
      DEFAULT: "hsla(39,70%,55%)",
      subtle: "hsla(44,100%,65%)",
      hover: "hsla(44,100%,50%)",
    },
    primary: {
      foreground: "hsla(0,0%,8%)",
      DEFAULT: "hsla(195,100%,70%)",
      subtle: "hsla(221,60%,25%)",
      hover: "hsla(195,70%,50%)",
    },
    secondary: {
      foreground: "hsla(0,0%,8%)",
      DEFAULT: "hsla(195,60%,80%)",
      subtle: "hsla(221,60%,25%)",
      hover: "hsla(221,83%,50%)",
      background: "hsla(202, 40%, 25%)",
    },
    info: {
      DEFAULT: "hsla(195,31%,25%)",
      subtle: "hsla(195, 100%,95%)",
      hover: "hsla(263, 70%, 50%)",
      foreground: "hsla(195, 70%, 92%)",
      notification: "hsla(263, 70%, 60%)",
    },
    warn: {
      DEFAULT: "hsla(45, 93%, 47%)",
      subtle: "hsla(48, 100%, 88%)",
      hover: "hsla(43, 96%, 56%)",
      foreground: "hsla(45, 5%, 11%)",
      notification: "hsla(45, 93%, 47%)",
    },
    danger: {
      DEFAULT: "hsla(0, 84%, 60%)",
      subtle: "hsla(0, 93%, 94%)",
      hover: "hsla(0, 90%, 51%)",
      foreground: "hsla(210, 40%, 98%)",
      notification: "hsla(0, 84%, 60%)",
    },
    success: {
      DEFAULT: "hsla(160, 84%, 39%)",
      subtle: "hsla(158, 64%, 52%)",
      hover: "hsla(160, 84%, 29%)",
      foreground: "hsla(158, 64%, 90%)",
      notification: "hsla(160, 84%, 39%)",
    },
    input: {
      border: "hsla(225, 12%, 22%)",
      placeholder: "hsla(225, 15%, 50%)",
      "mask-error": "hsla(0, 94%, 81%)",
      "switch-bg": "hsla(225, 12%, 15%)",
      switch: "hsla(0, 0%, 100%)",
      slider: "hsla(0, 0%, 100%)",
    },
    card: {
      muted: "hsla(225, 12%, 18%)",
      border: "hsla(225,12%,16%)",
      background: "hsla(225,12%,12%)",
    },
    floating: {
      foreground: "hsla(220, 15%, 95%)",
      background: "hsla(225,12%,14%)",
      hover: "hsla(225, 12%, 20%)",
      border: "hsla(225,12%,18%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    tooltip: {
      foreground: "hsla(210, 40%, 98%)",
      background: "hsla(0, 0%, 8%)",
      hover: "hsla(221, 10%, 35%)",
      border: "hsla(0, 0%, 19%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    table: {
      background: "hsla(225,12%,11%)",
      header: "hsla(225,12%,13%)",
      border: "hsla(225,12%,16%)",
    },
    button: {
      primary: {
        bg: "hsla(221,83%,60%)",
        text: "hsla(210,40%,98%)",
      },
      warn: {
        text: "hsla(45, 5%, 11%)",
        bg: "hsla(45, 93%, 47%)",
      },
      info: {
        bg: "hsla(263, 70%, 60%)",
        text: "hsla(263, 70%, 90%)",
      },
      success: {
        text: "hsla(158, 64%, 90%)",
        bg: "hsla(160, 84%, 39%)",
      },
      danger: {
        bg: "hsla(0, 84%, 60%)",
        text: "hsla(210, 40%, 98%)",
      },
      muted: {
        text: "hsla(218,15%,95%)",
        bg: "hsla(211,19%,34%)",
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
      primary: {
        bg: "hsla(200,94%,85%)",
        text: "hsla(200,98%,39%)",
      },
      warn: {
        text: "hsla(45, 5%, 11%)",
        bg: "hsla(45, 93%, 47%)",
      },
      info: {
        bg: "hsla(263, 100%, 95%)",
        text: "hsla(263, 70%, 60%)",
      },
      success: {
        text: "hsla(158, 64%, 90%)",
        bg: "hsla(160, 84%, 39%)",
      },
      danger: {
        bg: "hsla(0, 93%, 94%)",
        text: "hsla(0, 84%, 60%)",
      },
      neutral: {
        text: "hsla(200,98%,60%)",
        bg: "hsla(200,28%,19%)",
      },
      secondary: {
        text: "hsla(216,10%,90%)",
        bg: "hsla(214,7%,19%)",
      },
      muted: {
        bg: "hsla(203,40%,95%)",
        text: "hsla(202,35%,37%)",
      },
    },
    alert: {
      primary: {
        text: "hsla(200,94%,85%)",
        border: "hsla(200,98%,30%)",
        bg: "hsla(200,50%,8%)",
      },
      warn: {
        bg: "hsla(45,60%,8%)",
        border: "hsla(45,93%,47%)",
        text: "hsla(48,100%,88%)",
      },
      info: {
        bg: "hsla(263, 50%, 8%)",
        text: "hsla(263, 70%, 90%)",
        border: "hsla(263, 70%, 60%)",
      },
      success: {
        bg: "hsla(160,50%,8%)",
        text: "hsla(158,64%,90%)",
        border: "hsla(160,84%,39%)",
      },
      danger: {
        bg: "hsla(0,60%,8%)",
        text: "hsla(0,93%,94%)",
        border: "hsla(0,84%,60%)",
      },
      neutral: {
        text: "hsla(200,98%,60%)",
        bg: "hsla(200,28%,19%)",
        border: "hsla(200,90%,89%)",
      },
      secondary: {
        text: "hsla(220,9%,94%)",
        bg: "hsla(220,6%,10%)",
        border: "hsla(214,7%,19%)",
      },
      muted: {
        bg: "hsla(0, 0%, 12%)",
        border: "hsla(0, 0%, 40%)",
        text: "hsla(0, 100%, 100%)",
      },
    },
  },
};
