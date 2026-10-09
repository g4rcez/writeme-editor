import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

const colors = {
    foreground: "var(--var-color-foreground)",
    mutedForeground: "var(--var-color-muted-foreground)",
    border: "var(--var-color-border)",
    primary: "var(--var-color-primary)",
    primarySubtle: "var(--var-color-primary-subtle)",
    secondary: "var(--var-color-secondary)",
    secondarySubtle: "var(--var-color-secondary-subtle)",
    emphasis: "var(--var-color-primary)",
    info: "var(--var-color-info)",
    warn: "var(--var-color-warn)",
    danger: "var(--var-color-danger)",
    success: "var(--var-color-success)",
    floating: "var(--var-dropdown-surface-background)",
    floatingForeground: "var(--var-dropdown-surface-foreground)",
};

function createAppTheme(isDark: boolean) {
    const selectionBackground = `color-mix(in srgb, var(--var-color-primary) ${isDark ? "45%" : "28%"}, transparent)`;
    const theme = EditorView.theme(
        {
            "&": {
                backgroundColor: "transparent",
                color: colors.foreground,
            },
            ".cm-content": {
                caretColor: colors.primary,
            },
            ".cm-cursor, .cm-dropCursor": {
                borderLeftColor: colors.primary,
            },
            "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
                {
                    backgroundColor: selectionBackground,
                },
            ".cm-panels": {
                backgroundColor: colors.floating,
                color: colors.floatingForeground,
            },
            ".cm-panels.cm-panels-top": {
                borderBottom: `1px solid ${colors.border}`,
            },
            ".cm-panels.cm-panels-bottom": {
                borderTop: `1px solid ${colors.border}`,
            },
            ".cm-searchMatch": {
                backgroundColor: "color-mix(in srgb, var(--var-color-warn) 25%, transparent)",
                outline: `1px solid ${colors.warn}`,
            },
            ".cm-searchMatch.cm-searchMatch-selected": {
                backgroundColor: "color-mix(in srgb, var(--var-color-warn) 40%, transparent)",
            },
            ".cm-activeLine": {
                backgroundColor: "color-mix(in srgb, var(--var-color-muted) 50%, transparent)",
            },
            ".cm-selectionMatch": {
                backgroundColor: "color-mix(in srgb, var(--var-color-primary) 14%, transparent)",
            },
            "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
                backgroundColor: colors.secondarySubtle,
                color: colors.foreground,
            },
            ".cm-gutters": {
                backgroundColor: "transparent",
                color: colors.mutedForeground,
                border: "none",
            },
            ".cm-activeLineGutter": {
                backgroundColor: "color-mix(in srgb, var(--var-color-muted) 50%, transparent)",
            },
            ".cm-foldPlaceholder": {
                backgroundColor: "transparent",
                border: "none",
                color: colors.mutedForeground,
            },
            ".cm-placeholder": {
                color: colors.mutedForeground,
            },
            ".cm-tooltip": {
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.floating,
                color: colors.floatingForeground,
            },
            ".cm-tooltip .cm-tooltip-arrow:before": {
                borderTopColor: colors.border,
                borderBottomColor: colors.border,
            },
            ".cm-tooltip .cm-tooltip-arrow:after": {
                borderTopColor: colors.floating,
                borderBottomColor: colors.floating,
            },
            ".cm-tooltip-autocomplete": {
                "& > ul > li[aria-selected]": {
                    backgroundColor: colors.primarySubtle,
                    color: colors.foreground,
                },
            },
        },
        { dark: isDark },
    );

    const highlightStyle = HighlightStyle.define([
        { tag: t.keyword, color: colors.primary },
        {
            tag: [t.name, t.definition(t.name), t.deleted, t.character, t.macroName],
            color: colors.foreground,
        },
        {
            tag: [t.function(t.variableName), t.function(t.propertyName), t.propertyName, t.labelName],
            color: colors.secondary,
        },
        {
            tag: [t.color, t.constant(t.name), t.standard(t.name), t.bool, t.number],
            color: colors.emphasis,
        },
        { tag: [t.self, t.atom, t.invalid], color: colors.danger },
        {
            tag: [t.typeName, t.className, t.changed, t.annotation, t.namespace],
            color: colors.warn,
        },
        { tag: [t.operator, t.url], color: colors.info },
        { tag: [t.escape, t.regexp, t.special(t.variableName)], color: colors.primary },
        {
            tag: [t.meta, t.punctuation, t.separator, t.comment],
            color: colors.mutedForeground,
        },
        { tag: t.strong, fontWeight: "bold" },
        { tag: t.emphasis, fontStyle: "italic" },
        { tag: t.strikethrough, textDecoration: "line-through" },
        { tag: t.link, color: colors.secondary, textDecoration: "underline" },
        { tag: t.heading, fontWeight: "bold", color: colors.secondary },
        {
            tag: [t.processingInstruction, t.string, t.inserted],
            color: colors.success,
        },
    ]);

    return [theme, syntaxHighlighting(highlightStyle)];
}

export const appLightCodeMirrorTheme = () => createAppTheme(false);

export const appDarkCodeMirrorTheme = () => createAppTheme(true);
