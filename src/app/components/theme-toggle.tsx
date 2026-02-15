import { Moon, Sun } from "lucide-react";
import { useGlobalStore } from "../../store/global.store";

export const ThemeToggle = () => {
  const [state, dispatch] = useGlobalStore();
  const isDark = state.theme === "dark";

  return (
    <button
      type="button"
      onClick={() => dispatch.theme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex relative justify-center items-center w-8 h-8 rounded-md transition-all text-foreground/70 hover:text-foreground hover:bg-muted/30"
    >
      <Sun
        className={`absolute size-4 transition-all duration-300 ${isDark
            ? "rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100"
          }`}
      />
      <Moon
        className={`absolute w-4 h-4 transition-all duration-300 ${isDark
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-0 opacity-0"
          }`}
      />
    </button>
  );
};
