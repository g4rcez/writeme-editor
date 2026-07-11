import { isElectron } from "@/lib/is-electron";
import type { WritemeThemeTokens } from "./theme-css";

const appleLabel = "hsla(240, 24%, 96%)";
const appleBlack = isElectron() ? "hsla(0, 0%, 0%)" : "hsla(192, 2%, 10%)";
const overlay = "hsla(192, 2%, 3%)";
const appleSystemGray = "hsla(240, 2%, 57%)";
const appleSecondaryLabel = "hsla(240, 4%, 78%)";
const appleSystemGray4 = "hsla(240, 2%, 23%)";
const appleSystemGray5 = "hsla(240, 2%, 18%)";
const appleSystemGray6 = "hsla(240, 3%, 11%)";
const appleSystemAccent = "hsla(var(--native-system-accent, 210, 100%, 52%))";
const appleSystemGreen = "hsla(135, 64%, 50%)";
const appleSystemIndigo = "hsla(241, 73%, 63%)";
const appleSystemOrange = "hsla(36, 100%, 52%)";
const appleSystemPink = "hsla(348, 100%, 61%)";
const appleSystemPurple = "hsla(280, 85%, 65%)";
const appleSystemRed = "hsla(3, 100%, 61%)";
const appleSystemTeal = "hsla(197, 100%, 70%)";
const appleSystemYellow = "hsla(50, 100%, 52%)";

export const nativeTheme = {
    custom: {
        "json-bg": appleSystemGray6,
        "json-key": appleSystemAccent,
        "json-string": appleSystemGreen,
        "json-number": appleSystemOrange,
        "json-boolean": appleSystemPurple,
        "json-null": appleSystemGray,
        "json-separator": appleSystemTeal,
        "json-hover": appleSystemGray5,
        "json-caret": appleSystemGray,
    },
    colors: {
        background: appleBlack,
        foreground: appleLabel,
        border: appleSystemGray4,
        ring: appleSystemAccent,
        disabled: appleSystemGray,
        muted: {
            DEFAULT: appleSystemGray5,
            foreground: appleSecondaryLabel,
            subtle: appleSecondaryLabel,
            hover: appleSystemGray4,
        },
        emphasis: {
            foreground: appleBlack,
            DEFAULT: appleSystemOrange,
            subtle: "hsla(36, 100%, 16%)",
            hover: appleSystemYellow,
        },
        primary: {
            foreground: appleBlack,
            DEFAULT: appleSystemAccent,
            subtle: "hsla(var(--native-system-accent, 210, 100%, 52%), 0.16)",
            hover: appleSystemTeal,
        },
        secondary: {
            foreground: appleBlack,
            DEFAULT: appleSystemIndigo,
            subtle: "hsla(241, 73%, 16%)",
            hover: appleSystemPurple,
            background: appleSystemGray5,
        },
        info: {
            DEFAULT: appleSystemTeal,
            subtle: "hsla(197, 100%, 14%)",
            hover: appleSystemAccent,
            foreground: appleBlack,
            notification: appleSystemTeal,
        },
        warn: {
            DEFAULT: appleSystemYellow,
            subtle: "hsla(50, 100%, 14%)",
            hover: appleSystemOrange,
            foreground: appleBlack,
            notification: appleSystemYellow,
        },
        danger: {
            DEFAULT: appleSystemRed,
            subtle: "hsla(3, 100%, 15%)",
            hover: appleSystemPink,
            foreground: appleBlack,
            notification: appleSystemRed,
        },
        success: {
            DEFAULT: appleSystemGreen,
            subtle: "hsla(135, 64%, 14%)",
            hover: appleSystemTeal,
            foreground: appleBlack,
            notification: appleSystemGreen,
        },
        input: {
            border: appleSystemGray4,
            placeholder: appleSecondaryLabel,
            "mask-error": appleSystemPink,
            "switch-bg": appleSystemGray5,
            switch: appleLabel,
            slider: appleLabel,
        },
        card: {
            muted: appleSystemGray5,
            border: appleSystemGray4,
            background: appleSystemGray6,
        },
        floating: {
            foreground: appleLabel,
            background: appleSystemGray6,
            hover: appleSystemGray5,
            border: appleSystemGray4,
            overlay,
        },
        tooltip: {
            foreground: appleLabel,
            background: appleSystemGray5,
            hover: appleSystemGray4,
            border: appleSystemGray4,
            overlay,
        },
        table: {
            background: appleBlack,
            header: appleSystemGray6,
            border: appleSystemGray4,
        },
    },
} satisfies WritemeThemeTokens;
