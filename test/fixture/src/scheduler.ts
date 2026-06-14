import { deepClone } from "./utils.js";

export interface Task {
  id: string;
  priority: number;
  execute(): Promise<void>;
}

export class Scheduler {
  private queue: Task[] = [];

  enqueue(task: Task): void {
    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  async run(): Promise<void> {
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await task.execute();
    }
  }

  get pending(): number {
    return this.queue.length;
  }
}

export function createTask(id: string, priority: number, fn: () => Promise<void>): Task {
  return { id, priority, execute: fn };
}
