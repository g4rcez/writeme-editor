import { useEffect, useState } from "react";
import { sendMigrationData } from "@/lib/data-migration";

type Status = "sending" | "done" | "no-opener" | "error";

export default function MigratePage() {
  const [status, setStatus] = useState<Status>("sending");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.opener) {
      setStatus("no-opener");
      return;
    }

    sendMigrationData()
      .then(() => setStatus("done"))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      });
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen p-8 text-center">
      {status === "sending" && (
        <div className="space-y-2">
          <p className="text-lg font-medium">Sending your data...</p>
          <p className="text-sm text-muted-foreground">Please wait while your notes are transferred.</p>
        </div>
      )}
      {status === "done" && (
        <div className="space-y-2">
          <p className="text-lg font-medium text-green-600">Done!</p>
          <p className="text-sm text-muted-foreground">Your data has been sent. You can close this window.</p>
        </div>
      )}
      {status === "no-opener" && (
        <div className="space-y-2">
          <p className="text-lg font-medium text-red-600">Migration Error</p>
          <p className="text-sm text-muted-foreground">
            This page must be opened from <strong>app.writeme.dev</strong> using the migration button, not visited directly.
          </p>
        </div>
      )}
      {status === "error" && (
        <div className="space-y-2">
          <p className="text-lg font-medium text-red-600">Migration Failed</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}
    </div>
  );
}
