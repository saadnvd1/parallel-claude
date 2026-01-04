import { homedir } from "os";
import { join } from "path";

export const CONFIG = {
  // Base directory for all workers
  workersDir: join(homedir(), ".parallel-claude", "workers"),

  // State file to track active workers
  stateFile: join(homedir(), ".parallel-claude", "state.json"),

  // Default base port for dev servers
  basePort: 3100,

  // Port increment per worker
  portIncrement: 10,
};

export interface Worker {
  id: string;
  name: string;
  repoUrl: string;
  repoName: string;
  branch: string;
  task: string;
  directory: string;
  port: number;
  pid?: number;
  terminalTab?: string;
  createdAt: string;
  status: "setting-up" | "running" | "stopped" | "failed";
}

export interface State {
  workers: Worker[];
  nextPortOffset: number;
  itermWindowId?: string;
}

export const DEFAULT_STATE: State = {
  workers: [],
  nextPortOffset: 0,
};
