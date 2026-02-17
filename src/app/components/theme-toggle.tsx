import { Moon, Sun } from "lucide-react";
import { useGlobalStore } from "../../store/global.store";
import { SettingsRepository } from "../../store/settings";

export const ThemeToggle = () => {
  const [state, dispatch] = useGlobalStore();
  const isDark = state.theme === "dark";

  const toggleTheme = async () => {
    const nextTheme = isDark ? "light" : "dark";
    dispatch.theme(nextTheme);
    await SettingsRepository.save({ theme: nextTheme });
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
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
