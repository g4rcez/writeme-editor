import { useCallback, useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { tokyoNightStorm } from "@uiw/codemirror-theme-tokyo-night-storm";
import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";
import { Button } from "@g4rcez/components";
import { BracketsCurlyIcon } from "@phosphor-icons/react/dist/csr/BracketsCurly";
import { useGlobalStore } from "@/store/global.store";
import { controller } from "@/app/controller";

const jsonLightTheme = createTheme({
  theme: "light",
  settings: {
    background: "hsla(0, 0%, 100%)",
    foreground: "hsla(220, 30%, 15%)",
    caret: "hsla(213, 100%, 35%)",
    selection: "hsla(220, 15%, 94%)",
    selectionMatch: "hsla(220, 15%, 94%)",
    lineHighlight: "hsla(220, 15%, 94%)",
    gutterBackground: "hsla(0, 0%, 100%)",
    gutterForeground: "hsla(220, 10%, 55%)",
  },
  styles: [
    { tag: t.propertyName, color: "hsla(213, 100%, 35%)" },
    { tag: t.string, color: "hsla(150, 70%, 28%)" },
    { tag: t.number, color: "hsla(25, 90%, 45%)" },
    { tag: [t.bool, t.keyword], color: "hsla(270, 55%, 40%)" },
    { tag: t.null, color: "hsla(220, 10%, 55%)" },
    { tag: [t.punctuation, t.bracket], color: "hsla(220, 10%, 35%)" },
  ],
});

type Props = {
  value: string;
  onChange: (v: string) => void;
  className?: string;
};

export const JsonEditor = ({ value, onChange, className }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment());

  const [state] = useGlobalStore();
  const isDark = state.theme === "dark";

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          json(),
          themeCompartment.current.of(
            isDark ? tokyoNightStorm : jsonLightTheme,
          ),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
            }
          }),
          EditorView.theme({
            "&": { height: "100%", fontSize: "13px", overflow: "hidden" },
            ".cm-scroller": {
              overflow: "auto",
              fontFamily: "JetBrains Mono, monospace",
            },
          }),
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;

    (async () => {
      try {
        const text = await controller.clipboard();
        const parsed = JSON.parse(text);
        const formatted = JSON.stringify(parsed, null, 2);
        if (view.state.doc.length === 0) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: formatted },
          });
          onChange(formatted);
        }
      } catch {}
    })();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: themeCompartment.current.reconfigure(
        isDark ? tokyoNightStorm : jsonLightTheme,
      ),
    });
  }, [isDark]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  const handleFormat = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    try {
      const parsed = JSON.parse(view.state.doc.toString());
      const formatted = JSON.stringify(parsed, null, 2);
      const changes = { from: 0, to: view.state.doc.length, insert: formatted };
      view.dispatch({ changes });
      onChange(formatted);
    } catch {}
  }, [onChange]);

  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute top-2 right-2 z-10">
        <Button
          size="small"
          theme="ghost-primary"
          onClick={handleFormat}
          title="Format JSON"
        >
          <BracketsCurlyIcon size={14} />
        </Button>
      </div>
    </div>
  );
};
