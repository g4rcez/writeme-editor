export function runTemplateScript(code: string, context: unknown): unknown {
    return new Function("context", code)(context);
}
