const windowHash = globalThis.window?.location.hash;

export const isFloatingEditorWindow = windowHash !== undefined && /^#\/?floating-editor(?:[/?]|$)/.test(windowHash);
