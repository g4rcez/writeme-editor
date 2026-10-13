import { createWritemeThemeCss, type WritemeThemeTokens } from "./theme-css";

const systemAccent = "var(--native-system-accent, AccentColor)";
const systemBorder = "color-mix(in srgb, ButtonBorder 84%, Canvas)";
const systemOverlay = "color-mix(in srgb, CanvasText 24%, transparent)";

export const nativeTheme = {
    custom: {
        "json-bg": "Canvas",
        "json-key": "LinkText",
        "json-string": "CanvasText",
        "json-number": systemAccent,
        "json-boolean": "Mark",
        "json-null": "GrayText",
        "json-separator": systemBorder,
        "json-hover": "ButtonFace",
        "json-caret": "CanvasText",
    },
    colors: {
        background: "Canvas",
        foreground: "CanvasText",
        border: systemBorder,
        ring: systemAccent,
        disabled: "GrayText",
        muted: {
            DEFAULT: "ButtonFace",
            foreground: "GrayText",
            subtle: "ButtonFace",
            hover: "ButtonFace",
        },
        emphasis: {
            foreground: "MarkText",
            DEFAULT: "Mark",
            subtle: "ButtonFace",
            hover: "Mark",
        },
        primary: {
            foreground: "AccentColorText",
            DEFAULT: systemAccent,
            subtle: "ButtonFace",
            hover: systemAccent,
        },
        secondary: {
            foreground: "ButtonText",
            DEFAULT: "ButtonFace",
            subtle: "ButtonFace",
            hover: "ButtonFace",
            background: "ButtonFace",
        },
        info: {
            DEFAULT: systemAccent,
            subtle: "ButtonFace",
            hover: systemAccent,
            foreground: "AccentColorText",
            notification: systemAccent,
        },
        warn: {
            DEFAULT: "Mark",
            subtle: "ButtonFace",
            hover: "Mark",
            foreground: "MarkText",
            notification: "Mark",
        },
        danger: {
            DEFAULT: "CanvasText",
            subtle: "ButtonFace",
            hover: "CanvasText",
            foreground: "Canvas",
            notification: "CanvasText",
        },
        success: {
            DEFAULT: systemAccent,
            subtle: "ButtonFace",
            hover: systemAccent,
            foreground: "AccentColorText",
            notification: systemAccent,
        },
        input: {
            border: systemBorder,
            placeholder: "GrayText",
            "mask-error": "CanvasText",
            "switch-bg": "ButtonFace",
            switch: "ButtonText",
            slider: systemAccent,
        },
        card: {
            muted: "ButtonFace",
            border: systemBorder,
            background: "Canvas",
        },
        floating: {
            foreground: "CanvasText",
            background: "Canvas",
            hover: "ButtonFace",
            border: systemBorder,
            overlay: systemOverlay,
        },
        tooltip: {
            foreground: "CanvasText",
            background: "ButtonFace",
            hover: "ButtonFace",
            border: systemBorder,
            overlay: systemOverlay,
        },
        table: {
            background: "Canvas",
            header: "ButtonFace",
            border: systemBorder,
        },
    },
} satisfies WritemeThemeTokens;

export const createNativeThemeCss = (): string =>
    [createWritemeThemeCss("native", nativeTheme, "light"), "html.native {\n    color-scheme: light dark;\n}"].join(
        "\n\n",
    );
