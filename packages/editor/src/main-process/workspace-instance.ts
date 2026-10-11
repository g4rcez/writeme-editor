import { spawn } from "node:child_process";

export function launchWorkspaceProcess(args: string[], env: NodeJS.ProcessEnv): void {
    const child = spawn(process.execPath, args, { detached: true, env, stdio: "ignore" });
    child.unref();
}
