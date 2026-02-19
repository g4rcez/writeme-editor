import { createChatAdapter } from "@tanstack/ai-react";
import { AIMessage } from "../../store/repositories/electron/ai.repository";
import { v4 as uuidv4 } from "uuid";

export const aiAdapter = createChatAdapter({
  // This is a simplified version, we will handle the actual streaming via IPC
  async onSend({ messages, options }: any) {
    const lastMessage = messages[messages.length - 1];
    const { prompt, selection, context, commandTemplate } = options;

    // Send the query to the main process
    window.electronAPI.ai.query({
      commandTemplate,
      prompt,
      selection,
      context,
    });

    // We return an observable-like structure or handle the streaming via events
    // TanStack AI expects a specific return type or handle it via its own state
    // For now, we will use the IPC events to update the state
  },
});
