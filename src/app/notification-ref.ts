import type { useNotification } from "@g4rcez/components";

type NotifyFn = ReturnType<typeof useNotification>;

export const notificationRef: { current: NotifyFn | null } = { current: null };
