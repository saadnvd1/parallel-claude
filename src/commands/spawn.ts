import { execSync } from "child_process";
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";
import ora from "ora";
import { nanoid } from "nanoid";
import { CONFIG } from "../lib/config.js";
import {
  addWorker,
  generateWorkerName,
  generateBranchName,
  getRepoName,
  getAllWorkers,
  getNextPort,
  updateWorkerStatus,
} from "../lib/workers.js";
import { openWorkerTab, ensureItermRunning } from "../lib/iterm.js";

interface SpawnOptions {
  task: string[];
  branch?: string;
  port?: number;
  noDev?: boolean;
  name?: string;
}

export async function spawn(repoUrl: string, options: SpawnOptions) {
  const tasks = options.task;

  // Spawn a worker for each task
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    await spawnSingleWorker(repoUrl, task, options, i === 0);
  }

  if (tasks.length > 1) {
    console.log(chalk.green(`\n✨ Spawned ${tasks.length} workers!`));
  }
}

async function spawnSingleWorker(
  repoUrl: string,
  task: string,
  options: SpawnOptions,
  isFirstInBatch: boolean
) {
  const spinner = ora("Preparing worker...").start();

  try {
    // Generate worker details
    const existingNames = getAllWorkers().map((w) => w.name);
    const workerName = generateWorkerName(existingNames);
    const workerId = nanoid(10);
    const repoName = getRepoName(repoUrl);
    const port = getNextPort();
    const branchName = options.branch || generateBranchName(task, workerName);
    const workerDir = join(CONFIG.workersDir, workerName);

    spinner.text = `Creating worker ${chalk.cyan(workerName)}...`;

    // Create worker directory
    if (!existsSync(CONFIG.workersDir)) {
      mkdirSync(CONFIG.workersDir, { recursive: true });
    }

    if (existsSync(workerDir)) {
      spinner.fail(`Worker directory already exists: ${workerDir}`);
      process.exit(1);
    }

    // Clone repository
    spinner.text = `Cloning ${chalk.cyan(repoName)}...`;

    // Check for GitHub token
    let cloneUrl = repoUrl;
    const githubToken = process.env.GITHUB_TOKEN;
    if (githubToken && repoUrl.includes("github.com")) {
      cloneUrl = repoUrl.replace(
        "https://github.com",
        `https://${githubToken}@github.com`
      );
    }

    execSync(`git clone --depth 50 "${cloneUrl}" "${workerDir}"`, {
      stdio: "pipe",
    });

    // Setup git config
    execSync(`git config user.email "agent@parallel-claude.local"`, {
      cwd: workerDir,
      stdio: "pipe",
    });
    execSync(`git config user.name "Parallel Claude (${workerName})"`, {
      cwd: workerDir,
      stdio: "pipe",
    });

    // Create and checkout branch
    spinner.text = `Creating branch ${chalk.cyan(branchName)}...`;
    execSync(`git checkout -b "${branchName}"`, {
      cwd: workerDir,
      stdio: "pipe",
    });

    // Copy .env.local if it exists in home or current directory
    const envSources = [
      join(process.cwd(), ".env.local"),
      join(homedir(), ".env.local"),
    ];
    for (const envSource of envSources) {
      if (existsSync(envSource)) {
        copyFileSync(envSource, join(workerDir, ".env.local"));
        spinner.text = "Copied .env.local...";
        break;
      }
    }

    // Install dependencies
    spinner.text = "Installing dependencies...";
    const hasLockfile = (name: string) => existsSync(join(workerDir, name));

    let installCmd = "npm install";
    if (hasLockfile("bun.lockb")) {
      installCmd = "bun install";
    } else if (hasLockfile("pnpm-lock.yaml")) {
      installCmd = "pnpm install";
    } else if (hasLockfile("yarn.lock")) {
      installCmd = "yarn install";
    }

    execSync(installCmd, { cwd: workerDir, stdio: "pipe" });

    // Check if this is the first worker BEFORE adding
    const isFirstWorker = getAllWorkers().length === 0;

    // Create worker record
    const worker = {
      id: workerId,
      name: workerName,
      repoUrl,
      repoName,
      branch: branchName,
      task,
      directory: workerDir,
      port,
      createdAt: new Date().toISOString(),
      status: "setting-up" as const,
    };
    addWorker(worker);

    // Ensure iTerm2 is running
    spinner.text = "Opening iTerm2...";
    await ensureItermRunning();

    // Prepare commands
    let devCmd: string | null = null;
    if (!options.noDev) {
      devCmd = `npm run dev -- --port ${port}`;
      if (hasLockfile("bun.lockb")) {
        devCmd = `bun run dev --port ${port}`;
      }
    }

    const claudeCmd = `claude --dangerously-skip-permissions`;

    // Prepend system instruction to the task
    const fullTask = `Always make sure to follow CLAUDE.md before starting. Task: ${task}`;

    // Open iTerm tab with split panes (dev left, claude right)
    spinner.text = isFirstWorker
      ? "Creating new parallel-claude window..."
      : "Adding tab to parallel-claude window...";
    const windowId = await openWorkerTab(workerName, workerDir, devCmd, claudeCmd, fullTask, isFirstWorker);

    updateWorkerStatus(workerName, "running", { terminalTab: windowId });

    spinner.succeed(
      `Worker ${chalk.cyan(workerName)} is running!\n` +
        `   ${chalk.dim("Directory:")} ${workerDir}\n` +
        `   ${chalk.dim("Branch:")}    ${branchName}\n` +
        `   ${chalk.dim("Port:")}      ${port}\n` +
        `   ${chalk.dim("Task:")}      ${task}`
    );

    console.log(
      `\n${chalk.yellow("Tip:")} Use ${chalk.cyan(`parallel-claude cleanup ${workerName}`)} when done.`
    );
  } catch (error) {
    spinner.fail(
      `Failed to spawn worker: ${error instanceof Error ? error.message : error}`
    );
    process.exit(1);
  }
}
