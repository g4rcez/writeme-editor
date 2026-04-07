export class ClipboardListener {
  private intervalId: NodeJS.Timeout | null = null;
  private lastClipboardContent = "";
  private onClipboardChange: (content: string) => void;
  private isActive = false;
  private pollInterval = 500;

  constructor(onClipboardChange: (content: string) => void) {
    this.onClipboardChange = onClipboardChange;
  }

  async start() {
    if (this.isActive) return;
    this.isActive = true;
    try {
      this.lastClipboardContent = await window.electronAPI.notes.clipboard();
    } catch (error) {
      console.error("Failed to get initial clipboard content:", error);
      this.lastClipboardContent = "";
    }

    this.intervalId = setInterval(async () => {
      try {
        const currentContent = await window.electronAPI.notes.clipboard();
        if (currentContent !== this.lastClipboardContent) {
          this.lastClipboardContent = currentContent;
          this.onClipboardChange(currentContent);
        }
      } catch (error) {
        console.error("Failed to check clipboard:", error);
      }
    }, this.pollInterval);
  }

  stop() {
    if (!this.isActive) return;

    this.isActive = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isListening(): boolean {
    return this.isActive;
  }
}
