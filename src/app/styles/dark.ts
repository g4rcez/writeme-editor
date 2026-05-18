import { defaultDarkTheme } from "@g4rcez/components";

const foreground = "hsla(131, 20%, 80%)";

export const darkTheme: typeof defaultDarkTheme = {
  ...defaultDarkTheme,
  spacing: { ...defaultDarkTheme.spacing, sm: "0.875rem", lg: "1.125rem" },
  zIndex: { ...defaultDarkTheme.zIndex, tooltip: "30" },
  custom: {
    "json-bg": "hsla(0, 0%, 10%)",
    "json-key": "hsla(258, 100%, 80%)",
    "json-string": foreground,
    "json-number": "hsla(90, 74%, 57%)",
    "json-boolean": "hsla(258, 80%, 75%)",
    "json-null": "hsla(0, 0%, 45%)",
    "json-separator": "hsla(258, 80%, 75%)",
    "json-hover": "hsla(0, 0%, 13%)",
    "json-caret": "hsla(0, 0%, 45%)",
  },
  colors: {
    ...defaultDarkTheme.colors,
    foreground,
    background: "hsla(0, 0%, 9%)",
    border: "hsla(245, 12%, 15%)",
    disabled: "hsla(245, 20%, 40%)",
    muted: {
      ...defaultDarkTheme.colors.muted,
      DEFAULT: "hsla(0, 0%, 20%)",
    },
    emphasis: {
      foreground: "hsla(0, 0%, 9%)",
      DEFAULT: "hsla(90, 74%, 57%)",
      subtle: "hsla(90, 74%, 15%)",
      hover: "hsla(90, 74%, 50%)",
    },
    primary: {
      foreground: "hsla(0, 0%, 9%)",
      DEFAULT: "hsla(258, 100%, 80%)",
      subtle: "hsla(258, 100%, 18%)",
      hover: "hsla(258, 100%, 74%)",
    },
    secondary: {
      foreground: foreground,
      DEFAULT: "hsla(245, 40%, 48%)",
      subtle: "hsla(245, 44%, 18%)",
      hover: "hsla(245, 44%, 44%)",
      background: "hsla(245, 44%, 22%)",
    },
    info: {
      DEFAULT: "hsla(185, 90%, 65%)",
      subtle: "hsla(185, 100%, 12%)",
      hover: "hsla(185, 90%, 55%)",
      foreground: "hsla(0, 0%, 9%)",
      notification: "hsla(185, 90%, 65%)",
    },
    warn: {
      DEFAULT: "hsla(45, 100%, 60%)",
      subtle: "hsla(45, 50%, 15%)",
      hover: "hsla(45, 100%, 55%)",
      foreground: "hsla(45, 10%, 10%)",
      notification: "hsla(45, 100%, 60%)",
    },
    danger: {
      DEFAULT: "hsla(0, 85%, 65%)",
      subtle: "hsla(0, 50%, 15%)",
      hover: "hsla(0, 85%, 60%)",
      foreground: "hsla(0, 0%, 9%)",
      notification: "hsla(0, 85%, 65%)",
    },
    success: {
      DEFAULT: "hsla(150, 80%, 45%)",
      subtle: "hsla(150, 50%, 15%)",
      hover: "hsla(150, 80%, 40%)",
      foreground: "hsla(0, 0%, 9%)",
      notification: "hsla(150, 80%, 45%)",
    },
    input: {
      border: "hsla(245, 12%, 15%)",
      placeholder: "hsla(131, 20%, 50%)",
      "mask-error": "hsla(0, 94%, 81%)",
      "switch-bg": "hsla(0, 0%, 18%)",
      switch: foreground,
      slider: foreground,
    },
    card: {
      muted: "hsla(0, 0%, 11%)",
      border: "hsla(245, 12%, 15%)",
      background: "hsla(245, 2%, 9%)",
    },
    floating: {
      foreground: foreground,
      background: "hsla(0, 0%, 12%)",
      hover: "hsla(0, 0%, 16%)",
      border: "hsla(245, 12%, 15%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    tooltip: {
      foreground: foreground,
      background: "hsla(0, 0%, 10%)",
      hover: "hsla(0, 0%, 13%)",
      border: "hsla(245, 12%, 15%)",
      overlay: "hsla(0, 0%, 0%)",
    },
    table: {
      background: "hsla(0, 0%, 9%)",
      header: "hsla(0, 0%, 11%)",
      border: "hsla(245, 12%, 15%)",
    },
    button: {
      primary: {
        bg: "hsla(258, 100%, 80%)",
        text: "hsla(0, 0%, 9%)",
      },
      warn: {
        text: "hsla(45, 10%, 10%)",
        bg: "hsla(45, 100%, 60%)",
      },
      info: {
        bg: "hsla(185, 90%, 65%)",
        text: "hsla(0, 0%, 9%)",
      },
      success: {
        text: "hsla(0, 0%, 9%)",
        bg: "hsla(150, 80%, 45%)",
      },
      danger: {
        bg: "hsla(0, 85%, 65%)",
        text: "hsla(0, 0%, 9%)",
      },
      muted: {
        text: "hsla(131, 37%, 65%)",
        bg: "hsla(0, 0%, 16%)",
      },
      neutral: {
        text: foreground,
        bg: "hsla(245, 44%, 30%)",
      },
      secondary: {
        text: foreground,
        bg: "hsla(245, 44%, 36%)",
      },
    },
  },
};
