import type { WritemeThemeTokens } from "./theme-css";

const foreground = "hsla(131, 20%, 16%)";
const mutedForeground = "hsla(131, 10%, 30%)";
const background = "hsla(245, 20%, 99%)";
const surface = "hsla(245, 24%, 96%)";
const surfaceRaised = "hsla(245, 20%, 99%)";
const border = "hsla(245, 14%, 72%)";
const primary = "hsla(258, 58%, 38%)";
const primaryHover = "hsla(258, 62%, 32%)";
const primarySubtle = "hsla(258, 65%, 94%)";
const secondary = "hsla(245, 44%, 34%)";
const secondaryHover = "hsla(245, 44%, 28%)";
const secondarySubtle = "hsla(245, 55%, 94%)";
const emphasis = "hsla(90, 60%, 22%)";
const info = "hsla(185, 90%, 20%)";
const warn = "hsla(45, 100%, 20%)";
const danger = "hsla(0, 72%, 32%)";
const success = "hsla(150, 70%, 20%)";
const onDark = background;
const onWarn = "hsla(45, 20%, 8%)";

export const lightTheme = {
    custom: {
        "json-bg": background,
        "json-key": primary,
        "json-string": foreground,
        "json-number": emphasis,
        "json-boolean": primaryHover,
        "json-null": mutedForeground,
        "json-separator": secondary,
        "json-hover": surface,
        "json-caret": mutedForeground,
    },
    colors: {
        foreground,
        background,
        border,
        ring: primary,
        disabled: "hsla(131, 8%, 38%)",
        muted: {
            DEFAULT: surface,
            foreground: mutedForeground,
            subtle: mutedForeground,
            hover: surface,
        },
        emphasis: {
            foreground: onWarn,
            DEFAULT: emphasis,
            subtle: "hsla(90, 60%, 92%)",
            hover: "hsla(90, 64%, 18%)",
        },
        primary: {
            foreground: onDark,
            DEFAULT: primary,
            subtle: primarySubtle,
            hover: primaryHover,
        },
        secondary: {
            foreground: onDark,
            DEFAULT: secondary,
            subtle: secondarySubtle,
            hover: secondaryHover,
            background: "hsla(245, 48%, 92%)",
        },
        info: {
            DEFAULT: info,
            subtle: "hsla(185, 80%, 92%)",
            hover: "hsla(185, 90%, 16%)",
            foreground: onDark,
            notification: info,
        },
        danger: {
            DEFAULT: danger,
            subtle: "hsla(0, 72%, 94%)",
            hover: "hsla(0, 75%, 27%)",
            foreground: onDark,
            notification: danger,
        },
        warn: {
            DEFAULT: warn,
            subtle: "hsla(45, 95%, 90%)",
            hover: "hsla(45, 100%, 16%)",
            foreground: onWarn,
            notification: "hsla(45, 100%, 70%)",
        },
        success: {
            DEFAULT: success,
            subtle: "hsla(150, 65%, 91%)",
            hover: "hsla(150, 76%, 16%)",
            foreground: onDark,
            notification: success,
        },
        input: {
            border: "hsla(245, 16%, 55%)",
            placeholder: mutedForeground,
            "mask-error": "hsla(0, 72%, 38%)",
            "switch-bg": "hsla(245, 14%, 72%)",
            switch: surfaceRaised,
            slider: surfaceRaised,
        },
        card: {
            muted: surface,
            border: "hsla(245, 16%, 78%)",
            background: surfaceRaised,
        },
        floating: {
            foreground,
            background: surfaceRaised,
            hover: surface,
            border: "hsla(245, 16%, 72%)",
            overlay: "hsla(245, 20%, 6%)",
        },
        tooltip: {
            foreground,
            background: "hsla(245, 22%, 97%)",
            hover: surface,
            border: "hsla(245, 16%, 72%)",
            overlay: "hsla(245, 20%, 6%)",
        },
        table: {
            background,
            header: surface,
            border: "hsla(245, 16%, 78%)",
        },
    },
} satisfies WritemeThemeTokens;
