export type TemplateVariableSummary = {
	name: string;
	count: number;
};

const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\([^)]*\)/g;
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\([^)]*\)/g;
const FENCED_CODE_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`([^`]*)`/g;
const MARKDOWN_SYNTAX_PATTERN = /(^|\s)[#>*_~-]+/g;

export function getTemplateVariables(
	content: string,
): TemplateVariableSummary[] {
	const counts = new Map<string, number>();

	for (const match of content.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
		const variableName = match[1]?.trim().toUpperCase();
		if (!variableName) continue;
		counts.set(variableName, (counts.get(variableName) ?? 0) + 1);
	}

	return Array.from(counts.entries())
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function getTemplatePreview(content: string, maxLength = 180): string {
	const cleaned = content
		.replace(FENCED_CODE_PATTERN, " ")
		.replace(MARKDOWN_IMAGE_PATTERN, " ")
		.replace(MARKDOWN_LINK_PATTERN, "$1")
		.replace(INLINE_CODE_PATTERN, "$1")
		.replace(MARKDOWN_SYNTAX_PATTERN, " ")
		.replace(/\s+/g, " ")
		.trim();

	if (!cleaned) return "No preview content yet.";
	if (cleaned.length <= maxLength) return cleaned;

	return `${cleaned.slice(0, maxLength).trimEnd()}…`;
}

export function getTemplateStorageLabel(filePath: string | null): string {
	if (!filePath) return "Saved in writeme";

	const filename = filePath.split(/[\\/]/).filter(Boolean).at(-1);
	return filename ? filename : "Markdown file";
}
