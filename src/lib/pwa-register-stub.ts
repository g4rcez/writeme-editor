import type { RegisterSWOptions } from "virtual:pwa-register/react";

type SetBoolean = (value: boolean) => void;

export const useRegisterSW = (_options?: RegisterSWOptions) => ({
  needRefresh: [false, (() => {}) as SetBoolean] as [boolean, SetBoolean],
  offlineReady: [false, (() => {}) as SetBoolean] as [boolean, SetBoolean],
  updateServiceWorker: async (_reloadPage?: boolean): Promise<void> => {},
});
