type SetBoolean = (value: boolean) => void;

export const useRegisterSW = () => ({
  needRefresh: [false, (() => {}) as SetBoolean] as [boolean, SetBoolean],
  offlineReady: [false, (() => {}) as SetBoolean] as [boolean, SetBoolean],
  updateServiceWorker: async (_reloadPage?: boolean): Promise<void> => {},
});
