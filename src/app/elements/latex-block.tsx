import katex from "katex";
import "katex/dist/katex.min.css";
import { useEffect, useRef } from "react";

export const LatexBlock = ({ code }: { code: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      katex.render(code, containerRef.current, { displayMode: true, throwOnError: false });
    } catch (err) {
      console.error("KaTeX render error:", err);
    }
  }, [code]);

  return (
    <div className="pt-4 border-t border-card-border">
      <div
        ref={containerRef}
        className="overflow-x-auto p-4 text-center"
        aria-label="LaTeX Formula"
      />
    </div>
  );
};
