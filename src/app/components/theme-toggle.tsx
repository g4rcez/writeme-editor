import { Moon, Sun } from "lucide-react";
import { useGlobalStore } from "../../store/global.store";

export const ThemeToggle = () => {
  const [state, dispatch] = useGlobalStore();
  const isDark = state.theme === "dark";

  return (
    <button
      onClick={() => dispatch.theme(isDark ? "light" : "dark")}
      className="relative flex items-center justify-center w-8 h-8 rounded-md text-foreground/70 transition-all hover:text-foreground hover:bg-muted/30"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Sun
        className={`absolute w-4 h-4 transition-all duration-300 ${
          isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
        }`}
      />
      <Moon
        className={`absolute w-4 h-4 transition-all duration-300 ${
          isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
        }`}
      />
    </button>
  );
};
