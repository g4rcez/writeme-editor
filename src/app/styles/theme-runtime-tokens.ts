import type {
	DesignTokens,
	ThemeState,
	ThemeTokens,
	TokenTree,
} from "@g4rcez/components";

const themeStates: ThemeState[] = [
	"primary",
	"warn",
	"secondary",
	"info",
	"danger",
	"success",
	"neutral",
	"muted",
];

const alpha = (color: string, value: number): string =>
	color.startsWith("hsla(") ? color.replace(/\)$/, `, ${value})`) : color;

const componentStateTokens = (
	tokens: Record<ThemeState, { bg: string; text: string }>,
): TokenTree => {
	const output: Record<string, TokenTree> = {};
	for (const state of themeStates) {
		const token = tokens[state];
		output[state] = {
			background: token.bg,
			foreground: token.text,
		};
	}
	return output;
};

const tagStateTokens = (
	tokens: Record<ThemeState, { bg: string; text: string }>,
): TokenTree => ({
	...componentStateTokens(tokens),
	disabled: {
		background: "var(--var-color-disabled)",
		foreground: "var(--var-color-muted-foreground)",
	},
	neutral: {
		background: tokens.neutral.bg,
		foreground: tokens.neutral.text,
		border: "var(--var-color-border)",
	},
});

export const createThemeTokens = (theme: DesignTokens): ThemeTokens => ({
	colors: {
		background: theme.colors.background,
		foreground: theme.colors.foreground,
		border: theme.colors.border,
		ring: theme.colors.ring ?? theme.colors.primary.DEFAULT,
		disabled: theme.colors.disabled,
		muted: {
			DEFAULT: theme.colors.muted.DEFAULT,
			foreground: theme.colors.muted.foreground,
			subtle: theme.colors.muted.subtle,
			hover: theme.colors.muted.hover,
		},
		primary: theme.colors.primary,
		secondary: theme.colors.secondary,
		emphasis: theme.colors.emphasis,
		info: theme.colors.info,
		warn: theme.colors.warn,
		danger: theme.colors.danger,
		success: theme.colors.success,
		floating: theme.colors.floating,
		tooltip: theme.colors.tooltip,
		card: theme.colors.card,
		table: theme.colors.table,
		input: theme.colors.input,
	},
	components: {
		button: {
			height: theme.components.button.height,
			"big-height": theme.components.button["height-big"],
			"min-height": theme.components.button["height-min"],
			"small-height": theme.components.button["height-small"],
			"tiny-height": theme.components.button["height-tiny"],
			px: theme.components.button["padding-x"],
			py: theme.components.button["padding-y"],
			"big-px": theme.components.button["padding-x-big"],
			"big-py": theme.components.button["padding-y-big"],
			"min-px": theme.components.button["padding-x-min"],
			"min-py": theme.components.button["padding-y-min"],
			"small-px": theme.components.button["padding-x-small"],
			"small-py": theme.components.button["padding-y-small"],
			"tiny-px": theme.components.button["padding-x-tiny"],
			"tiny-py": theme.components.button["padding-y-tiny"],
			"icon-p": theme.components.button["padding-icon"],
			gap: theme.components.button.gap,
			"font-size": theme.components.button.text,
			"big-font-size": theme.components.button["text-big"],
			"min-font-size": theme.components.button["text-min"],
			"small-font-size": theme.components.button["text-small"],
			"tiny-font-size": theme.components.button["text-tiny"],
			"icon-font-size": theme.components.button["text-icon"],
			rounded: theme.components.button.radius,
			"rough-rounded": theme.components.button["radius-rough"],
			"squared-rounded": theme.components.button["radius-squared"],
			...componentStateTokens(theme.colors.button),
			neutral: {
				background: theme.colors.button.neutral.bg,
				foreground: theme.colors.button.neutral.text,
				border: "var(--var-color-border)",
			},
			"ghost-info": {
				"background-hover": alpha(theme.colors.info.DEFAULT, 0.2),
			},
			"ghost-warn": {
				"background-hover": alpha(theme.colors.warn.DEFAULT, 0.2),
			},
			"ghost-danger": {
				"background-hover": alpha(theme.colors.danger.DEFAULT, 0.2),
			},
			"ghost-primary": {
				"background-hover": alpha(theme.colors.primary.DEFAULT, 0.2),
			},
			"ghost-success": {
				"background-hover": alpha(theme.colors.success.DEFAULT, 0.2),
			},
			"ghost-secondary": {
				"background-hover": alpha(theme.colors.secondary.DEFAULT, 0.2),
			},
			"ghost-muted": {
				"background-hover": alpha(theme.colors.muted.DEFAULT, 0.2),
			},
		},
		tag: {
			height: theme.components.tag.height,
			"big-height": theme.components.tag["height-big"],
			"small-height": theme.components.tag["height-small"],
			"tiny-height": theme.components.tag["height-tiny"],
			px: theme.components.tag["padding-x"],
			py: theme.components.tag["padding-y"],
			"big-px": theme.components.tag["padding-x-big"],
			"big-py": theme.components.tag["padding-y-big"],
			"small-px": theme.components.tag["padding-x-small"],
			"small-py": theme.components.tag["padding-y-small"],
			"tiny-px": theme.components.tag["padding-x-tiny"],
			"tiny-py": theme.components.tag["padding-y-tiny"],
			"icon-p": theme.components.tag["padding-icon"],
			gap: theme.components.tag.gap,
			"small-font-size": theme.components.tag["text-small"],
			"tiny-font-size": theme.components.tag["text-tiny"],
			rounded: theme.components.tag.radius,
			"indicator-size": theme.components.tag["indicator-size"],
			...tagStateTokens(theme.colors.tag),
		},
		spinner: {
			size: theme.components.spinner.size,
			"border-width": theme.components.spinner.border,
			"container-p": theme.components.spinner["container-p"],
			"track-color": "var(--var-color-background)",
			"indicator-color": "var(--var-color-primary)",
		},
		empty: {
			gap: theme.components.empty.gap,
			px: theme.components.empty.px,
			py: theme.components.empty.py,
			foreground: "var(--var-color-muted-foreground)",
		},
		progress: {
			"track-h": theme.components.progress["track-h"],
			rounded: theme.components.progress.radius,
			"track-background": "var(--var-color-muted)",
			"indicator-background": "var(--var-color-primary)",
			"label-foreground": "var(--var-color-primary-foreground)",
		},
		stats: {
			rounded: theme.components.stats.radius,
			p: theme.components.stats.p,
			gap: theme.components.stats.gap,
			"icon-size": theme.components.stats["icon-size"],
			"icon-p": theme.components.stats["icon-p"],
			"inner-gap": theme.components.stats["inner-gap"],
			"footer-px": theme.components.stats["footer-px"],
			"footer-py": theme.components.stats["footer-py"],
			"title-font-size": theme.components.stats["title-text"],
			"value-font-size": theme.components.stats["value-text"],
			background: "var(--var-color-background)",
			"border-color": "var(--var-color-border)",
			"icon-background": "var(--var-color-primary)",
			"icon-foreground": "var(--var-color-primary-foreground)",
		},
		input: {
			height: theme.components.input.height,
			px: theme.components.input["padding-x"],
			py: theme.components.input["padding-y"],
			rounded: theme.components.input.radius,
			"font-size": theme.components.input.text,
			"mask-error-background": theme.colors.input["mask-error"],
			"placeholder-foreground": theme.colors.input.placeholder,
		},
		table: {
			"border-color": theme.colors.table.border,
		},
	},
	spacing: theme.spacing,
	rounded: theme.rounded,
	shadow: {
		card: theme.shadow["shadow-card"],
		floating: theme.shadow["shadow-floating"],
		notification: theme.shadow["shadow-notification"],
		table: theme.shadow["shadow-table"],
	},
	layer: theme.zIndex,
});
