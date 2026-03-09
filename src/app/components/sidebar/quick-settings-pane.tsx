import { GLOBAL_THEMES } from "@/app/settings/theme";
import { useGlobalStore } from "@/store/global.store";
import { Autocomplete } from "@g4rcez/components";

export const QuickSettingsPane = () => {
  const [state, dispatch] = useGlobalStore();

  const onChangeTheme = (e: React.ChangeEvent<HTMLInputElement>) =>
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
            optionalText=" "
            value={state.theme}
            options={GLOBAL_THEMES}
            onChange={onChangeTheme}
          />
        </div>
      </div>
    </div>
  );
};
