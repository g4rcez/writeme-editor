import {
    createThemeCss,
    defaultDarkThemeTokens,
    type ThemeComponentOverrides,
    type ThemeConfiguration,
    type ThemeTokenOverrides,
} from "@g4rcez/components";

type LegacyColorTree = { [key: string]: string | LegacyColorTree };

export type WritemeThemeTokens = {
    colors: LegacyColorTree;
    custom?: Record<string, string>;
};

type ThemeBase = "light" | "dark";
type ThemeName = "default" | "dark" | "catppuccin-mocha" | "tokyonight-night" | "native";

const isTree = (value: string | LegacyColorTree | undefined): value is LegacyColorTree =>
    typeof value === "object" && value !== null;

const get = (tree: LegacyColorTree | undefined, path: string[], fallback = "transparent"): string => {
    let value: string | LegacyColorTree | undefined = tree;
    for (const key of path) {
        if (!isTree(value) || !Object.hasOwn(value, key)) return fallback;
        value = value[key];
    }
    return typeof value === "string" ? value : fallback;
};

const alpha = (color: string, value: number): string => {
    const body = color.match(/^hsla?\((.*)\)$/)?.[1];
    return body ? `hsla(${body}, ${value})` : color;
};

const toLibraryColors = (colors: LegacyColorTree): NonNullable<ThemeTokenOverrides["colors"]> => ({
    background: get(colors, ["background"]),
    border: get(colors, ["border"]),
    danger: get(colors, ["danger", "DEFAULT"]),
    "danger-foreground": get(colors, ["danger", "foreground"]),
    "danger-hover": get(colors, ["danger", "hover"]),
    "danger-subtle": get(colors, ["danger", "subtle"]),
    disabled: get(colors, ["disabled"]),
    foreground: get(colors, ["foreground"]),
    info: get(colors, ["info", "DEFAULT"]),
    "info-foreground": get(colors, ["info", "foreground"]),
    "info-hover": get(colors, ["info", "hover"]),
    "info-subtle": get(colors, ["info", "subtle"]),
    muted: get(colors, ["muted", "DEFAULT"]),
    "muted-foreground": get(colors, ["muted", "foreground"]),
    primary: get(colors, ["primary", "DEFAULT"]),
    "primary-foreground": get(colors, ["primary", "foreground"]),
    "primary-hover": get(colors, ["primary", "hover"]),
    "primary-subtle": get(colors, ["primary", "subtle"]),
    ring: get(colors, ["ring"]),
    secondary: get(colors, ["secondary", "DEFAULT"]),
    "secondary-foreground": get(colors, ["secondary", "foreground"]),
    "secondary-hover": get(colors, ["secondary", "hover"]),
    "secondary-subtle": get(colors, ["secondary", "subtle"]),
    success: get(colors, ["success", "DEFAULT"]),
    "success-foreground": get(colors, ["success", "foreground"]),
    "success-hover": get(colors, ["success", "hover"]),
    "success-subtle": get(colors, ["success", "subtle"]),
    warn: get(colors, ["warn", "DEFAULT"]),
    "warn-foreground": get(colors, ["warn", "foreground"]),
    "warn-hover": get(colors, ["warn", "hover"]),
    "warn-subtle": get(colors, ["warn", "subtle"]),
});

const deriveComponentColors = (colors: LegacyColorTree): ThemeComponentOverrides => {
    const background = get(colors, ["background"]);
    const foreground = get(colors, ["foreground"]);
    const border = get(colors, ["border"]);
    const muted = get(colors, ["muted", "DEFAULT"]);
    const mutedForeground = get(colors, ["muted", "foreground"]);
    const primary = get(colors, ["primary", "DEFAULT"]);
    const primaryForeground = get(colors, ["primary", "foreground"]);
    const secondary = get(colors, ["secondary", "DEFAULT"]);
    const secondaryForeground = get(colors, ["secondary", "foreground"]);
    const floatingBackground = get(colors, ["floating", "background"], background);
    const floatingForeground = get(colors, ["floating", "foreground"], foreground);
    const floatingBorder = get(colors, ["floating", "border"], border);
    const tooltipBackground = get(colors, ["tooltip", "background"], foreground);
    const tooltipForeground = get(colors, ["tooltip", "foreground"], background);
    const tooltipBorder = get(colors, ["tooltip", "border"], tooltipBackground);
    const tableHeader = get(colors, ["table", "header"], muted);

    const state = (name: string) => ({
        background: get(colors, [name, "DEFAULT"]),
        foreground: get(colors, [name, "foreground"]),
    });
    const softState = (name: string) => {
        const value = get(colors, [name, "DEFAULT"]);
        return {
            background: get(colors, [name, "subtle"], alpha(value, 0.14)),
            foreground: value,
            border: alpha(value, 0.35),
        };
    };

    const primaryAlert = softState("primary");
    const infoAlert = softState("info");
    const warnAlert = softState("warn");
    const dangerAlert = softState("danger");
    const successAlert = softState("success");
    const primaryTag = state("primary");
    const infoTag = state("info");
    const warnTag = state("warn");
    const dangerTag = state("danger");
    const successTag = state("success");
    const secondaryTag = state("secondary");

    return {
        alert: {
            "primary-background": primaryAlert.background,
            "primary-foreground": primaryAlert.foreground,
            "primary-border": primaryAlert.border,
            "info-background": infoAlert.background,
            "info-foreground": infoAlert.foreground,
            "info-border": infoAlert.border,
            "warn-background": warnAlert.background,
            "warn-foreground": warnAlert.foreground,
            "warn-border": warnAlert.border,
            "danger-background": dangerAlert.background,
            "danger-foreground": dangerAlert.foreground,
            "danger-border": dangerAlert.border,
            "success-background": successAlert.background,
            "success-foreground": successAlert.foreground,
            "success-border": successAlert.border,
        },
        autocomplete: {
            "option-background-hover": muted,
            "option-active-background": primary,
            "option-active-foreground": primaryForeground,
            "option-selected-background": muted,
            "option-selected-foreground": foreground,
            "panel-background": floatingBackground,
            "panel-border": floatingBorder,
            "panel-foreground": floatingForeground,
            "empty-border": border,
            "empty-foreground": mutedForeground,
        },
        button: {
            "secondary-background": secondary,
            "secondary-foreground": secondaryForeground,
            "ghost-info-background-hover": alpha(get(colors, ["info", "DEFAULT"]), 0.2),
            "ghost-warn-background-hover": alpha(get(colors, ["warn", "DEFAULT"]), 0.2),
            "ghost-danger-background-hover": alpha(get(colors, ["danger", "DEFAULT"]), 0.2),
            "ghost-primary-background-hover": alpha(primary, 0.2),
            "ghost-success-background-hover": alpha(get(colors, ["success", "DEFAULT"]), 0.2),
            "ghost-secondary-background-hover": alpha(secondary, 0.2),
            "ghost-muted-background-hover": alpha(muted, 0.2),
        },
        calendar: {
            "day-button-background-hover": alpha(muted, 0.48),
            "focus-border": alpha(primary, 0.78),
            "focus-ring": alpha(primary, 0.18),
            "today-border": alpha(primary, 0.38),
            "outside-month-foreground": alpha(mutedForeground, 0.42),
            "selected-ring": alpha(primary, 0.14),
            "selected-background-hover": alpha(primary, 0.92),
            "range-border": alpha(primary, 0.28),
            "range-background": alpha(primary, 0.08),
            "nav-button-border-hover": alpha(primary, 0.28),
            "nav-button-background-hover": alpha(primary, 0.1),
            "select-background-hover": alpha(muted, 0.42),
        },
        card: {
            background: get(colors, ["card", "background"], background),
            border: get(colors, ["card", "border"], border),
            muted: get(colors, ["card", "muted"], muted),
            "stats-panel-background-hover": alpha(primary, 0.1),
        },
        command: {
            "surface-background": floatingBackground,
            "surface-foreground": floatingForeground,
            "surface-border": floatingBorder,
            "group-label-foreground": mutedForeground,
            "item-background-hover": muted,
            "empty-foreground": mutedForeground,
        },
        dropdown: {
            "surface-background": floatingBackground,
            "surface-foreground": floatingForeground,
            "surface-border": floatingBorder,
        },
        menu: {
            "surface-background": floatingBackground,
            "surface-foreground": floatingForeground,
            "surface-border": floatingBorder,
            "item-active-background": primary,
            "item-active-foreground": primaryForeground,
        },
        modal: {
            "overlay-background": alpha(get(colors, ["floating", "overlay"], "hsla(0, 0%, 0%)"), 0.8),
        },
        radiobox: {
            "control-foreground": primary,
            "control-background": background,
            "control-border": border,
            "mark-foreground": primaryForeground,
            "focus-ring": primary,
        },
        checkbox: {
            "control-foreground": primary,
            "control-background": background,
            "control-border": border,
            "mark-foreground": primaryForeground,
            "focus-ring": primary,
        },
        switch: {
            "thumb-checked-background": get(colors, ["input", "switch"], background),
        },
        slider: {
            "thumb-background": get(colors, ["input", "slider"], background),
        },
        table: {
            background: get(colors, ["table", "background"], background),
            border: get(colors, ["table", "border"], border),
            "header-background": tableHeader,
            "inline-placeholder-color": mutedForeground,
        },
        tag: {
            "primary-background": primaryTag.background,
            "primary-foreground": primaryTag.foreground,
            "info-background": infoTag.background,
            "info-foreground": infoTag.foreground,
            "warn-background": warnTag.background,
            "warn-foreground": warnTag.foreground,
            "danger-background": dangerTag.background,
            "danger-foreground": dangerTag.foreground,
            "success-background": successTag.background,
            "success-foreground": successTag.foreground,
            "secondary-background": secondaryTag.background,
            "secondary-foreground": secondaryTag.foreground,
            "muted-background": muted,
            "muted-foreground": mutedForeground,
            "disabled-background": get(colors, ["disabled"], muted),
            "disabled-foreground": mutedForeground,
            "neutral-background": "transparent",
            "neutral-foreground": foreground,
            "neutral-border": border,
        },
        tooltip: {
            "surface-background": tooltipBackground,
            "surface-foreground": tooltipForeground,
            "surface-border": tooltipBorder,
        },
        wizard: {
            "surface-background": floatingBackground,
            "surface-foreground": floatingForeground,
            "surface-border": floatingBorder,
            "overlay-background": alpha(get(colors, ["floating", "overlay"], "hsla(0, 0%, 0%)"), 0.7),
            "label-foreground": mutedForeground,
            "label-foreground-hover": foreground,
        },
    };
};

const mergeComponentOverrides = (
    base: ThemeComponentOverrides,
    overrides: ThemeComponentOverrides,
): ThemeComponentOverrides => {
    const componentNames = new Set([...Object.keys(base), ...Object.keys(overrides)]);
    const merged = Object.fromEntries(
        [...componentNames].map((name) => {
            const component = name as keyof ThemeComponentOverrides;
            return [
                name,
                {
                    ...(base[component] as Record<string, string | undefined> | undefined),
                    ...(overrides[component] as Record<string, string | undefined> | undefined),
                },
            ];
        }),
    );
    return merged as ThemeComponentOverrides;
};

const createCustomCss = (name: ThemeName, theme: WritemeThemeTokens): string => {
    const customLines = Object.entries(theme.custom ?? {}).map(([key, value]) => `    --${key}: ${value};`);
    if (customLines.length === 0) return "";

    const selector = name === "default" ? ":root" : `html.${name}`;
    return `${selector} {\n${customLines.join("\n")}\n}`;
};

export const createWritemeThemeCss = (name: ThemeName, theme: WritemeThemeTokens, baseName: ThemeBase): string => {
    const colors = toLibraryColors(theme.colors);
    const components = deriveComponentColors(theme.colors);
    const usesDarkBase = baseName === "dark";
    const configuration: ThemeConfiguration = {
        name,
        colorScheme: baseName,
        tokens: { spacing: "0.875rem" },
        colors: usesDarkBase ? { ...defaultDarkThemeTokens.colors, ...colors } : colors,
        components: usesDarkBase ? mergeComponentOverrides(defaultDarkThemeTokens.components, components) : components,
    };

    return [createThemeCss(configuration), createCustomCss(name, theme)].filter(Boolean).join("\n\n");
};
