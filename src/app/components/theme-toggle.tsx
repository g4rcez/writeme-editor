import { useGlobalStore } from "@/store/global.store";
import { SettingsService } from "@/store/settings";
import { Button } from "@g4rcez/components";
import { MoonIcon } from "@phosphor-icons/react/dist/csr/Moon";
import { SunIcon } from "@phosphor-icons/react/dist/csr/Sun";

export const ThemeToggle = () => {
  const [state, dispatch] = useGlobalStore();
  const isDark = state.theme === "dark";

  const toggleTheme = async () => {
    const nextTheme = isDark ? "light" : "dark";
    dispatch.theme(nextTheme);
    await SettingsService.save({ theme: nextTheme });
  };

  return (
    <Button
      type="button"
      size="small"
      theme="ghost-muted"
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <SunIcon
        className={`absolute size-4 transition-all duration-300 ${
          isDark
            ? "rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100"
        }`}
      />
      <MoonIcon
        className={`absolute size-4 transition-all duration-300 ${
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-0 opacity-0"
        }`}
      />
    </Button>
  );
};
