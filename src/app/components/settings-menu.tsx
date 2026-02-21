import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { useGlobalStore } from "@/store/global.store";
import { NavbarButton } from "./navbar-button";

export const SettingsMenu = () => {
  const [, dispatch] = useGlobalStore();
  return (
    <NavbarButton
      title="Settings"
      Icon={GearIcon}
      aria-label="Settings menu"
      onClick={() => dispatch.commander(true)}
    />
  );
};
