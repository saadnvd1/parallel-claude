import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { CONFIG, State, Worker, DEFAULT_STATE } from "./config.js";

/**
 * Load state from disk
 */
export function loadState(): State {
  try {
    if (existsSync(CONFIG.stateFile)) {
      const data = readFileSync(CONFIG.stateFile, "utf-8");
      return JSON.parse(data);
    }
  } catch {
    // Ignore errors, return default
  }
  return { ...DEFAULT_STATE };
}

/**
 * Save state to disk
 */
export function saveState(state: State): void {
  const dir = dirname(CONFIG.stateFile);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(CONFIG.stateFile, JSON.stringify(state, null, 2));
}

/**
 * Add a worker to state
 */
export function addWorker(worker: Worker): void {
  const state = loadState();
  state.workers.push(worker);
  state.nextPortOffset++;
  saveState(state);
}

/**
 * Remove a worker from state
 */
export function removeWorker(nameOrId: string): Worker | undefined {
  const state = loadState();
  const index = state.workers.findIndex(
    (w) => w.name === nameOrId || w.id === nameOrId
  );

  if (index === -1) return undefined;

  const [removed] = state.workers.splice(index, 1);
  saveState(state);
  return removed;
}

/**
 * Get a worker by name or ID
 */
export function getWorker(nameOrId: string): Worker | undefined {
  const state = loadState();
  return state.workers.find((w) => w.name === nameOrId || w.id === nameOrId);
}

/**
 * Get all workers
 */
export function getAllWorkers(): Worker[] {
  return loadState().workers;
}

/**
 * Update worker status
 */
export function updateWorkerStatus(
  nameOrId: string,
  status: Worker["status"],
  updates?: Partial<Worker>
): void {
  const state = loadState();
  const worker = state.workers.find(
    (w) => w.name === nameOrId || w.id === nameOrId
  );
  if (worker) {
    worker.status = status;
    if (updates) {
      Object.assign(worker, updates);
    }
    saveState(state);
  }
}

/**
 * Get next available port
 */
export function getNextPort(): number {
  const state = loadState();
  return CONFIG.basePort + state.nextPortOffset * CONFIG.portIncrement;
}

/**
 * Generate a unique worker name
 */
const adjectives = [
  "swift", "brave", "calm", "bright", "bold", "keen", "wise", "quick",
  "sharp", "cool", "warm", "fair", "pure", "true", "kind", "proud",
];

const animals = [
  "fox", "owl", "eagle", "wolf", "bear", "hawk", "deer", "lion",
  "tiger", "raven", "falcon", "panther", "jaguar", "leopard", "lynx", "otter",
];

export function generateWorkerName(existingNames: string[] = []): string {
  const existing = new Set(existingNames);

  for (let i = 0; i < 100; i++) {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const name = `${adj}-${animal}`;

    if (!existing.has(name)) {
      return name;
    }
  }

  // Fallback with timestamp
  return `worker-${Date.now()}`;
}

/**
 * Extract repo name from URL
 */
export function getRepoName(repoUrl: string): string {
  const match = repoUrl.match(/\/([^/]+?)(\.git)?$/);
  return match ? match[1] : "repo";
}

/**
 * Generate branch name from task
 */
export function generateBranchName(task: string, workerName: string): string {
  const slug = task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)
    .replace(/^-|-$/g, "");

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `feat/${slug}-${workerName}-${date}`;
}

/**
 * Get the iTerm window ID for parallel-claude workers
 */
export function getItermWindowId(): string | undefined {
  return loadState().itermWindowId;
}

/**
 * Set the iTerm window ID for parallel-claude workers
 */
export function setItermWindowId(windowId: string): void {
  const state = loadState();
  state.itermWindowId = windowId;
  saveState(state);
}

/**
 * Clear the iTerm window ID (when all workers are cleaned up)
 */
export function clearItermWindowId(): void {
  const state = loadState();
  delete state.itermWindowId;
  saveState(state);
}
