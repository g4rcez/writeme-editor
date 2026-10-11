import type { CapacitorConfig } from "@capacitor/cli";
import { mobileConfig } from "../mobile/capacitor.shared.ts";

export default { ...mobileConfig } satisfies CapacitorConfig;
