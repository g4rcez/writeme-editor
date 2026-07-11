import {
    createThemeCss,
    defaultDarkThemeTokens,
    defaultLightThemeTokens,
    mergeThemeTokens,
    type ThemeTokens,
    type TokenTree,
} from "@g4rcez/components";

export type WritemeThemeTokens = ThemeTokens & {
    custom?: Record<string, string>;
};

type ThemeBase = "light" | "dark";

const bases = {
    light: defaultLightThemeTokens,
    dark: defaultDarkThemeTokens,
} satisfies Record<ThemeBase, ThemeTokens>;

const isTree = (value: string | TokenTree | undefined): value is TokenTree =>
    typeof value === "object" && value !== null;

const get = (tree: TokenTree | undefined, path: string[], fallback = "transparent"): string => {
    let value: string | TokenTree | undefined = tree;
    for (const key of path) {
        if (!isTree(value)) return fallback;
        value = value[key];
    }
    return typeof value === "string" ? value : fallback;
};

const alpha = (color: string, value: number): string => {
    const body = color.match(/^hsla?\((.*)\)$/)?.[1];
    return body ? `hsla(${body}, ${value})` : color;
};

const derivedComponentColors = (colors: TokenTree): TokenTree => {
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
    const softState = (name: string) => ({
        background: get(colors, [name, "subtle"], alpha(get(colors, [name, "DEFAULT"]), 0.14)),
        foreground: get(colors, [name, "DEFAULT"]),
        border: alpha(get(colors, [name, "DEFAULT"]), 0.35),
    });

    return {
        alert: {
            primary: softState("primary"),
            info: softState("info"),
            warn: softState("warn"),
            danger: softState("danger"),
            success: softState("success"),
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
            secondary: {
                background: secondary,
                foreground: secondaryForeground,
            },
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
        "free-text": {
            "placeholder-foreground": mutedForeground,
            "error-placeholder-foreground": get(colors, ["danger", "subtle"]),
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
            "header-background": tableHeader,
            "inline-placeholder-color": mutedForeground,
        },
        tag: {
            primary: state("primary"),
            info: state("info"),
            warn: state("warn"),
            muted: { background: muted, foreground: mutedForeground },
            danger: state("danger"),
            success: state("success"),
            secondary: state("secondary"),
            disabled: {
                background: get(colors, ["disabled"], muted),
                foreground: mutedForeground,
            },
            neutral: { background: "transparent", foreground, border },
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

const toTuple = (color: string): string => color.match(/^hsla?\((.*)\)$/)?.[1] ?? color;

const flattenLegacyColors = (tree: TokenTree, path: string[] = []): string[] =>
    Object.entries(tree).flatMap(([key, value]) => {
        const next = [...path, key];
        if (isTree(value)) return flattenLegacyColors(value, next);

        const body = toTuple(value);
        if (key === "DEFAULT") {
            const baseName = path.join("-");
            return [`    --${baseName}: ${body};`, `    --${baseName}-DEFAULT: ${body};`];
        }
        return [`    --${next.join("-")}: ${body};`];
    });

const createLegacyCss = (selector: string, theme: WritemeThemeTokens, base: ThemeTokens): string => {
    const merged = mergeThemeTokens(base, theme);
    const colorLines = merged.colors ? flattenLegacyColors(merged.colors) : [];
    const customLines = Object.entries(theme.custom ?? {}).map(([key, value]) => `    --${key}: ${value};`);
    return `${selector} {\n${[...colorLines, ...customLines].join("\n")}\n}`;
};

export const createWritemeThemeCss = (selector: string, theme: WritemeThemeTokens, baseName: ThemeBase): string => {
    const base = bases[baseName];
    const merged = mergeThemeTokens(base, theme);
    const themed: WritemeThemeTokens = {
        ...theme,
        components: derivedComponentColors(merged.colors ?? {}),
    };

    return [createThemeCss(themed, { selector, base }), createLegacyCss(selector, themed, base)].join("\n\n");
};
