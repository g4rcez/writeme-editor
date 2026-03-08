import { useGlobalStore } from "@/store/global.store";
import { Autocomplete } from "@g4rcez/components";

const themes = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export const QuickSettingsPane = () => {
  const [state, dispatch] = useGlobalStore();
  const onChangeTheme = (e: React.ChangeEvent<HTMLSelectElement>) =>
    dispatch.theme(e.target.value);
  return (
    <div className="flex flex-col h-full bg-background/50">
      <div className="py-2 px-4 border-b border-border/20">
        <span className="font-bold tracking-wider uppercase text-[10px] text-muted-foreground">
          Quick Settings
        </span>
      </div>

      <div className="overflow-y-auto p-4 space-y-6">
        <div className="space-y-3">
          <label className="font-medium uppercase text-[10px] text-muted-foreground">
            Appearance
          </label>
          <Autocomplete
            title="Theme"
            options={themes}
            value={state.theme}
            onChange={onChangeTheme}
          />
        </div>
      </div>
    </div>
  );
};
