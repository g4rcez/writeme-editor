import { useEffect, useMemo } from "react";
import { shortcuts } from "../../lib/shortcuts";
import { useGlobalStore } from "../../store/global.store";

type Shortcut = {
  hidden?: boolean;
  description: string;
  bind: string;
  action: () => any;
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
          hidden: true,
          description: "Commander",
          bind: "mod+/",
          action: () => dispatch.commander(true),
        },
        {
          description: "Reload",
          bind: "mod+r",
          action: () => window.location.reload(),
        },
        {
          description: "Zoom out",
          bind: "mod+-",
          action: () => zoom((a, b) => a - b),
        },
        {
          description: "Zoom in",
          bind: "mod+=",
          action: () => zoom((a, b) => a + b),
        },
        {
          description: "Zoom normal",
          bind: "mod+0",
          action: () => zoom(() => 1),
        },
        {
          description: "Shortcut/Help menu",
          bind: "mod+/",
          action: () => dispatch.help(true),
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
