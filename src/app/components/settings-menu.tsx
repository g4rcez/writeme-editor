import { SettingsIcon } from "lucide-react";
import { useGlobalStore } from "../../store/global.store";
import { NavbarButton } from "./navbar-button";

export const SettingsMenu = () => {
  const [, dispatch] = useGlobalStore();
  return (
    <NavbarButton
      title="Settings"
      Icon={SettingsIcon}
      aria-label="Settings menu"
      onClick={() => dispatch.commander(true)}
    />
  );
};
