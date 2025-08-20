import { useEffect } from "react";
import { useGlobalStore } from "../store/global.store";

export enum Key {
  Shift = "shift",
  Control = "control",
  Command = "cmd",
  Alt = "alt",
  Space = " ",
  Enter = "enter",
}

export type ShortcutOptions = {
  prevent?: boolean;
  multiPlatform?: boolean;
  description?: string;
  eventType: keyof WindowEventMap;
};

export type Undef<T> = undefined | T;

export type BrowserOptions = Partial<{
  capture: Undef<boolean>;
  once: Undef<boolean>;
  passive: Undef<boolean>;
  signal: Undef<AbortSignal>;
}>;

export type ShortcutValue = {
  target: EventListener;
  options: ShortcutOptions;
  nativeOptions: BrowserOptions;
};

export const shortcutKeys = (
  element: HTMLElement | Window,
  mod = "Meta",
) => {
  const shortcutMap = new Map<string, ShortcutValue>();
  const incrementUserAction = (
    e: KeyboardEvent,
    options: Partial<ShortcutOptions>,
  ) => {
    if (!e.key) return;
    const key = e.key.toLowerCase().replace("mod", mod);
    let keys = [];
    if (options.multiPlatform && (e.ctrlKey || e.metaKey))
      keys.push(Key.Control);
    else if (e.ctrlKey) keys.push(Key.Control);
    else if (e.metaKey) keys.push(Key.Command);
    if (e.shiftKey) keys.push(Key.Shift);
    if (e.altKey) keys.push(Key.Alt);
    if (key === Key.Space) keys.push("space");
    if (key === Key.Enter) keys.push(Key.Enter);
    if (key) keys.push(key);
    keys = keys.map((key) => key.trim()).filter(Boolean);
    const concatKeys = keys.join("+");
    console.log(concatKeys, shortcutMap);
    const eventFound = shortcutMap.get(concatKeys);
    if (eventFound && options.prevent) e.preventDefault();
    return concatKeys;
  };

  const defaultOptions: ShortcutOptions = {
    description: "",
    multiPlatform: true,
    prevent: true,
    eventType: "keydown",
  };

  const defaultNativeOptions: BrowserOptions = {
    capture: undefined,
    once: undefined,
    passive: undefined,
    signal: undefined,
  };
  const add = (
    shortcut: string | string[],
    handler: (ev: KeyboardEvent) => any,
    options: Partial<ShortcutOptions> = defaultOptions,
    nativeOptions: BrowserOptions = defaultNativeOptions,
  ): void => {
    const concatOptions = { ...defaultOptions, ...options };
    const concatNativeOptions = { ...defaultOptions, ...nativeOptions };
    const shortcuts = Array.isArray(shortcut) ? shortcut : [shortcut];
    shortcuts.forEach((shortcutItem) => {
      const key = shortcutItem.toLowerCase().trim().replace("mod", mod);
      const target = (e: KeyboardEvent) => {
        const x = incrementUserAction(e as KeyboardEvent, options);
        return x === key ? handler(e as KeyboardEvent) : undefined;
      };
      shortcutMap.set(key, {
        nativeOptions: concatNativeOptions,
        options: concatOptions,
        target: target as any,
      });
      element.addEventListener(
        concatOptions.eventType,
        target as any,
        concatNativeOptions,
      );
    });
  };
  const removeAll = () =>
    Object.entries(shortcutMap).forEach(
      ([_, { target, options, nativeOptions }]) => {
        element.removeEventListener(
          options.eventType as any,
          target,
          nativeOptions,
        );
      },
    );
  const remove = (shortcut: string): void => {
    const x = shortcutMap.get(shortcut);
    if (x === undefined) return;
    return element.removeEventListener(x.options.eventType!, x!.target);
  };
  const list = () =>
    Array.from(shortcutMap).map(([key, info]) => ({ key, info }));
  return { add, remove, removeAll, list };
};

export const shortcuts = shortcutKeys(window, "control");
