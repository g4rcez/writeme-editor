import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { isElectron } from "@/lib/is-electron";

const ELECTRON = isElectron();

export const usePwaUpdate = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!ELECTRON && needRefresh) updateServiceWorker(true);
  }, [needRefresh, updateServiceWorker]);
};
