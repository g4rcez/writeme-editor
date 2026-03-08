import { useCallback, useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { tokyoNightStorm } from "@uiw/codemirror-theme-tokyo-night-storm";
import { Button } from "@g4rcez/components";
import { BracketsCurlyIcon } from "@phosphor-icons/react/dist/csr/BracketsCurly";
import { useGlobalStore } from "@/store/global.store";

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
          themeCompartment.current.of(isDark ? tokyoNightStorm : []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
            }
          }),
          EditorView.theme({
            "&": { height: "100%", fontSize: "13px" },
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
        isDark ? tokyoNightStorm : [],
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
