import type { ClientMessage, ServerMessage } from "../shared.ts";

export interface ConnectionHandlers {
  onMessage: (message: ServerMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * Thin, typed wrapper around the browser WebSocket that speaks the universe
 * protocol. Parsing/serialization and connection lifecycle live here so the
 * store and UI only ever deal with typed messages.
 */
export class Connection {
  private readonly ws: WebSocket;

  constructor(url: string, handlers: ConnectionHandlers) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener("open", () => handlers.onOpen?.());
    this.ws.addEventListener("close", () => handlers.onClose?.());
    this.ws.addEventListener("message", (event) => {
      try {
        handlers.onMessage(JSON.parse(event.data as string) as ServerMessage);
      } catch {
        // Ignore unparseable frames rather than crashing the render loop.
      }
    });
  }

  send(message: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  close(): void {
    this.ws.close();
  }
}
