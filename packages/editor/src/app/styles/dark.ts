import type { WritemeThemeTokens } from "./theme-css";

const foreground = "hsla(131, 20%, 80%)";
const mutedForeground = "hsla(131, 20%, 74%)";

export const darkTheme = {
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
        foreground,
        background: "hsla(0, 0%, 9%)",
        border: "hsla(245, 12%, 15%)",
        ring: "hsla(258, 100%, 80%)",
        disabled: "hsla(245, 20%, 40%)",
        muted: {
            DEFAULT: "hsla(0, 0%, 20%)",
            foreground: mutedForeground,
            subtle: mutedForeground,
            hover: "hsla(0, 0%, 24%)",
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
            subtle: "hsla(258, 40%, 16%)",
            hover: "hsla(258, 100%, 74%)",
        },
        secondary: {
            foreground,
            DEFAULT: "hsla(245, 43%, 75%)",
            subtle: "hsla(245, 44%, 18%)",
            hover: "hsla(245, 44%, 68%)",
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
            DEFAULT: "hsla(0, 85%, 76%)",
            subtle: "hsla(0, 50%, 15%)",
            hover: "hsla(0, 85%, 70%)",
            foreground: "hsla(0, 0%, 9%)",
            notification: "hsla(0, 85%, 76%)",
        },
        success: {
            DEFAULT: "hsla(150, 80%, 48%)",
            subtle: "hsla(150, 50%, 15%)",
            hover: "hsla(150, 80%, 43%)",
            foreground: "hsla(0, 0%, 9%)",
            notification: "hsla(150, 80%, 48%)",
        },
        input: {
            border: "hsla(245, 12%, 19%)",
            placeholder: mutedForeground,
            "mask-error": "hsla(0, 94%, 81%)",
            "switch-bg": "hsla(0, 0%, 18%)",
            switch: foreground,
            slider: foreground,
        },
        card: {
            muted: "hsla(0, 0%, 11%)",
            border: "hsla(245, 10%, 16%)",
            background: "hsla(245, 2%, 9%)",
        },
        floating: {
            foreground,
            background: "hsla(245, 2%, 9%)",
            hover: "hsla(0, 0%, 16%)",
            border: "hsla(245, 12%, 18%)",
            overlay: "hsla(0, 0%, 0%)",
        },
        tooltip: {
            foreground,
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
    },
} satisfies WritemeThemeTokens;
