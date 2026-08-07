import type { HookEvent, ReceivedEvent } from "./types.js";

const MAX_HISTORY = 200;

export class EventStore {
  private history: ReceivedEvent[] = [];

  add(event: HookEvent): ReceivedEvent {
    const received: ReceivedEvent = { ...event, receivedAt: Date.now() };
    this.history.push(received);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
    return received;
  }

  getHistory(): ReceivedEvent[] {
    return this.history;
  }
}
