import { useEffect, useRef } from "react";
import "mathjax/tex-mml-chtml.js";

interface MathJax {
  typesetPromise: (elements?: HTMLElement[]) => Promise<void>;
}

declare global {
  interface Window {
    MathJax?: MathJax;
  }
}

export const LatexBlock = ({ code }: { code: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && window.MathJax) {
      window.MathJax.typesetPromise([containerRef.current]).catch((err) =>
        console.error("MathJax typeset error:", err),
      );
    }
  }, [code]);

  return (
    <div className="pt-4 border-t border-card-border">
      <div
        ref={containerRef}
        className="overflow-x-auto p-4 text-center"
        aria-label="LaTeX Formula"
      >
        {code}
      </div>
    </div>
  );
};
