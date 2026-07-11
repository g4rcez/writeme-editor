type HotkeyEvent = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "key">;

type HotkeyCallback = (event: KeyboardEvent) => void;

type HotkeyOptions = {
    target?: Window;
    preventDefault?: boolean;
    stopPropagation?: boolean;
};

type NormalizedHotkey = {
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    modKey: boolean;
    shiftKey: boolean;
    key: string;
};

type HotkeyBinding = {
    hotkey: NormalizedHotkey;
    callback: HotkeyCallback;
    preventDefault: boolean;
    stopPropagation: boolean;
};

type HotkeyRegistry = {
    bindings: Set<HotkeyBinding>;
    listener: (event: KeyboardEvent) => void;
};

const registries = new WeakMap<Window, HotkeyRegistry>();

function normalizeKey(key: string): string {
    const normalizedKey = key.trim().toLowerCase();
    if (normalizedKey === "esc") return "escape";
    if (normalizedKey === "space") return " ";
    return normalizedKey;
}

function parseHotkey(hotkey: string): NormalizedHotkey {
    const parts = hotkey
        .split("+")
        .map((part) => part.trim())
        .filter(Boolean);
    const key = parts.at(-1);
    if (!key) {
        throw new Error("Hotkey must include a key");
    }

    const normalizedHotkey: NormalizedHotkey = {
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        modKey: false,
        shiftKey: false,
        key: normalizeKey(key),
    };

    for (const modifier of parts.slice(0, -1)) {
        switch (modifier.toLowerCase()) {
            case "alt":
            case "option":
                normalizedHotkey.altKey = true;
                break;
            case "cmd":
            case "command":
            case "meta":
                normalizedHotkey.metaKey = true;
                break;
            case "ctrl":
            case "control":
                normalizedHotkey.ctrlKey = true;
                break;
            case "mod":
                normalizedHotkey.modKey = true;
                break;
            case "shift":
                normalizedHotkey.shiftKey = true;
                break;
            default:
                throw new Error(`Unsupported hotkey modifier: ${modifier}`);
        }
    }

    return normalizedHotkey;
}

function matchesHotkey(event: HotkeyEvent, hotkey: NormalizedHotkey): boolean {
    if (normalizeKey(event.key) !== hotkey.key) return false;
    if (event.altKey !== hotkey.altKey) return false;
    if (event.shiftKey !== hotkey.shiftKey) return false;

    if (hotkey.modKey) {
        if (!event.ctrlKey && !event.metaKey) return false;
        return true;
    }

    return event.ctrlKey === hotkey.ctrlKey && event.metaKey === hotkey.metaKey;
}

function getRegistry(target: Window): HotkeyRegistry {
    const existingRegistry = registries.get(target);
    if (existingRegistry) return existingRegistry;

    const bindings = new Set<HotkeyBinding>();
    const listener = (event: KeyboardEvent): void => {
        for (const binding of Array.from(bindings).reverse()) {
            if (!matchesHotkey(event, binding.hotkey)) continue;
            if (binding.preventDefault) event.preventDefault();
            if (binding.stopPropagation) event.stopPropagation();
            binding.callback(event);
            break;
        }
    };
    const registry = { bindings, listener };
    target.addEventListener("keydown", listener);
    registries.set(target, registry);
    return registry;
}

function removeRegistryIfEmpty(target: Window, registry: HotkeyRegistry): void {
    if (registry.bindings.size > 0) return;
    target.removeEventListener("keydown", registry.listener);
    registries.delete(target);
}

export function registerHotkey(hotkey: string, callback: HotkeyCallback, options: HotkeyOptions = {}): () => void {
    const target = options.target ?? window;
    const registry = getRegistry(target);
    const binding: HotkeyBinding = {
        hotkey: parseHotkey(hotkey),
        callback,
        preventDefault: options.preventDefault ?? true,
        stopPropagation: options.stopPropagation ?? false,
    };

    registry.bindings.add(binding);

    return () => {
        registry.bindings.delete(binding);
        removeRegistryIfEmpty(target, registry);
    };
}

export function registerHotkeys(
    bindings: Array<{
        hotkey: string;
        callback: HotkeyCallback;
        options?: Omit<HotkeyOptions, "target">;
    }>,
    options: Pick<HotkeyOptions, "target"> = {},
): () => void {
    const unregisterHandlers = bindings.map((binding) =>
        registerHotkey(binding.hotkey, binding.callback, {
            ...binding.options,
            target: options.target,
        }),
    );
    return () => {
        for (const unregister of unregisterHandlers) unregister();
    };
}
