const windowHash = globalThis.window?.location.hash;

export const isFloatingEditorWindow = windowHash !== undefined && /^#\/?floating-editor(?:[/?]|$)/.test(windowHash);

export const isSecondaryWindow =
    windowHash !== undefined && /^#\/?(?:floating-editor|quicknote|mathnote)(?:[/?]|$)/.test(windowHash);
