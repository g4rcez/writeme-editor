import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

const colors = {
    foreground: "hsl(var(--foreground))",
    mutedForeground: "hsl(var(--muted-foreground))",
    border: "hsl(var(--border))",
    primary: "hsl(var(--primary))",
    primarySubtle: "hsl(var(--primary-subtle))",
    secondary: "hsl(var(--secondary))",
    secondarySubtle: "hsl(var(--secondary-subtle))",
    emphasis: "hsl(var(--emphasis))",
    info: "hsl(var(--info))",
    warn: "hsl(var(--warn))",
    danger: "hsl(var(--danger))",
    success: "hsl(var(--success))",
    floating: "hsl(var(--floating-background))",
    floatingForeground: "hsl(var(--floating-foreground))",
};

function createAppTheme(isDark: boolean) {
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
                    backgroundColor: "hsl(var(--primary) / 0.2)",
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
                backgroundColor: "hsl(var(--warn) / 0.25)",
                outline: `1px solid ${colors.warn}`,
            },
            ".cm-searchMatch.cm-searchMatch-selected": {
                backgroundColor: "hsl(var(--warn) / 0.4)",
            },
            ".cm-activeLine": {
                backgroundColor: "hsl(var(--muted) / 0.5)",
            },
            ".cm-selectionMatch": {
                backgroundColor: "hsl(var(--primary) / 0.14)",
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
                backgroundColor: "hsl(var(--muted) / 0.5)",
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
