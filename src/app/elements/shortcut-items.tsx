import { useEffect, useMemo } from "react";
import { shortcuts } from "../../lib/shortcuts";
import { globalDispatch, useGlobalStore } from "../../store/global.store";

const noop = () => {};

export enum Type {
  Shortcut = "shortcut",
  Command = "command",
}

export type Shortcut = {
  bind: string;
  hidden?: boolean;
  action: () => any;
  description: string;
  type: Type;
};

const zoom = (op: (a: number, b: number) => number) => {
  const value =
    window
      .getComputedStyle(window.document.querySelector(":root")!)
      .getPropertyValue("--default-size") || "1rem";
  const int = value.replace(/rem$/g, "");
  window.document.documentElement.style.setProperty(
    "--default-size",
    `${op(+int, 0.25)}rem`,
  );
};

export const useWritemeShortcuts = () => {
  const [, dispatch] = useGlobalStore();
  return useMemo(
    (): Shortcut[] =>
      [
        {
          bind: "mod+shift+m",
          type: Type.Shortcut,
          description: "Toggle Mode",
          action: () => {
            document.documentElement.classList.toggle("dark");
            globalDispatch.theme((prev) =>
              prev === "dark" ? "light" : "dark",
            );
          },
        },
        {
          hidden: true,
          bind: "mod+k",
          type: Type.Shortcut,
          description: "Commander",
          action: () => dispatch.commander(true),
        },
        {
          description: "Reload",
          bind: "mod+r",
          type: Type.Shortcut,
          action: () => window.location.reload(),
        },
        {
          description: "Zoom out",
          bind: "mod+-",
          type: Type.Shortcut,
          action: () => zoom((a, b) => a - b),
        },
        {
          description: "Zoom in",
          bind: "mod+=",
          type: Type.Shortcut,
          action: () => zoom((a, b) => a + b),
        },
        {
          description: "Zoom normal",
          bind: "mod+0",
          type: Type.Shortcut,
          action: () => zoom(() => 1),
        },
        {
          description: "Shortcut/Help menu",
          bind: "mod+/",
          type: Type.Shortcut,
          action: () => dispatch.help(true),
        },
        {
          description: "Start copy watcher mode",
          bind: ">>copy",
          type: Type.Command,
          action: noop,
        },
        {
          description:
            "Parse and solve the math expression until your next `=`",
          bind: ">>math",
          type: Type.Command,
          action: noop,
        },
      ].toSorted((a, b) =>
        a.bind.toLocaleLowerCase().localeCompare(b.bind.toLocaleLowerCase()),
      ),
    [],
  );
};

export const useShortcuts = () => {
  const commands = useWritemeShortcuts();
  useEffect(() => {
    commands.forEach((x) => {
      if (x.hidden) return;
      shortcuts.add(x.bind, x.action);
    });
    return () => {
      shortcuts.removeAll();
    };
  }, []);
};

const IOS_DEVICES = [
  "iPad Simulator",
  "iPhone Simulator",
  "iPod Simulator",
  "iPad",
  "iPhone",
  "iPod",
  "AppleWebkit",
  "Apple",
];

function iOS() {
  return (
    IOS_DEVICES.includes(navigator.platform) ||
    IOS_DEVICES.some((x) => navigator.userAgent.includes(x)) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  );
}

export const mapShortcutOS = (s: string) =>
  s.replace("mod+", iOS() ? "⌘ + " : "Ctrl + ");

export const ShortcutItem = (props: { shortcut: Shortcut }) => (
  <li className="flex flex-row gap-2 items-center">
    <kbd className="flex flex-row gap-2 items-center py-1 px-2 font-medium rounded-md bg-background">
      {props.shortcut.bind.split("+").map((x, i) => {
        return (
          <span key={`bind-${i}-${x}`}>
            {x === "mod" ? (iOS() ? "⌘" : "Ctrl") : x}
          </span>
        );
      })}
    </kbd>
    <span>{props.shortcut.description}</span>
  </li>
);
