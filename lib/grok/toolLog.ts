export type ToolLogEntry = {
  name: string;
  args: unknown;
  output: string;
};

type Listener = (entries: ToolLogEntry[]) => void;

let entries: ToolLogEntry[] = [];
const listeners = new Set<Listener>();

export function recordToolCall(entry: ToolLogEntry): void {
  entries = [...entries, entry];
  console.log("[tool]", entry.name, entry.args, entry.output);
  for (const listener of listeners) {
    listener(entries);
  }
}

export function getToolLog(): ToolLogEntry[] {
  return entries;
}

export function subscribeToolLog(listener: Listener): () => void {
  listeners.add(listener);
  listener(entries);
  return () => {
    listeners.delete(listener);
  };
}

export function resetToolLog(): void {
  entries = [];
  for (const listener of listeners) {
    listener(entries);
  }
}
