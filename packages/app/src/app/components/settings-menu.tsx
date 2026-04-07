import { useGlobalStore } from "@/store/global.store";
import { CommandIcon } from "@phosphor-icons/react";
import { NavbarButton } from "./navbar-button";

export const SettingsMenu = () => {
  const [, dispatch] = useGlobalStore();
  return (
    <NavbarButton
      title="Settings"
      Icon={CommandIcon}
      aria-label="Settings menu"
      onClick={() => dispatch.commander(true)}
    />
  );
};
