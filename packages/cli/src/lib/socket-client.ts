import net from "node:net";

export type CliMessage =
    | {
          action: "open-file";
          filePath: string | null;
          wait: boolean;
          requestId: string;
      }
    | { action: "open-folder"; folderPath: string; requestId: string };

export function sendToSocket(socketPath: string, msg: CliMessage): Promise<void> {
    return new Promise((resolve, reject) => {
        const client = net.createConnection(socketPath);
        let settled = false;

        const settle = (fn: () => void) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            fn();
        };

        const timer = setTimeout(() => {
            client.destroy();
            reject(new Error("Timed out connecting to writeme socket"));
        }, 5000);

        client.on("connect", () => {
            client.write(JSON.stringify(msg) + "\n");

            const isWait = msg.action === "open-file" && msg.wait;
            if (!isWait) {
                settle(resolve);
                client.end();
                return;
            }

            let buffer = "";
            client.on("data", (chunk) => {
                buffer += chunk.toString();
                const nl = buffer.indexOf("\n");
                if (nl === -1) return;
                const line = buffer.slice(0, nl);
                try {
                    const parsed = JSON.parse(line) as { status: string };
                    if (parsed.status === "closed" || parsed.status === "opened") {
                        settle(resolve);
                        client.end();
                    }
                } catch {
                    // keep waiting
                }
            });
        });

        client.on("end", () => settle(resolve));

        client.on("error", (err) => settle(() => reject(err)));
    });
}
