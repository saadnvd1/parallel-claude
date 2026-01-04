import { rmSync, existsSync } from "fs";
import chalk from "chalk";
import ora from "ora";
import { getAllWorkers, removeWorker, getWorker, clearItermWindowId } from "../lib/workers.js";
import { closeItermTab, sendToItermSession } from "../lib/iterm.js";

interface CleanupOptions {
  all?: boolean;
  force?: boolean;
}

export async function cleanup(nameOrId: string | undefined, options: CleanupOptions) {
  if (options.all) {
    await cleanupAll(options.force);
    return;
  }

  if (!nameOrId) {
    console.log(chalk.red("Error: Please specify a worker name or use --all"));
    console.log(`\nUsage: ${chalk.cyan("parallel-claude cleanup <worker-name>")}`);
    console.log(`       ${chalk.cyan("parallel-claude cleanup --all")}`);
    process.exit(1);
  }

  const spinner = ora(`Cleaning up ${chalk.cyan(nameOrId)}...`).start();

  try {
    const worker = getWorker(nameOrId);

    if (!worker) {
      spinner.fail(`Worker not found: ${nameOrId}`);
      console.log(`\nRun ${chalk.cyan("parallel-claude list")} to see active workers.`);
      process.exit(1);
    }

    // Try to close iTerm tab gracefully
    if (worker.terminalTab) {
      spinner.text = "Closing terminal tabs...";
      try {
        // Send Ctrl+C first to stop any running processes
        await sendToItermSession(worker.terminalTab, "\\x03");
        await new Promise((r) => setTimeout(r, 500));
        await closeItermTab(worker.terminalTab);
      } catch {
        // Tab might already be closed
      }
    }

    // Delete directory
    if (existsSync(worker.directory)) {
      spinner.text = "Removing directory...";
      try {
        rmSync(worker.directory, { recursive: true, force: true, maxRetries: 3 });
      } catch {
        // Fallback to rm -rf for stubborn directories (node_modules, etc)
        const { execSync } = await import("child_process");
        execSync(`rm -rf "${worker.directory}"`, { stdio: "pipe" });
      }
    }

    // Remove from state
    removeWorker(nameOrId);

    // Clear window ID if no workers left
    if (getAllWorkers().length === 0) {
      clearItermWindowId();
    }

    spinner.succeed(`Cleaned up ${chalk.cyan(worker.name)}`);
    console.log(`   ${chalk.dim("Directory removed:")} ${worker.directory}`);
    console.log(`   ${chalk.dim("Branch was:")} ${worker.branch}`);
  } catch (error) {
    spinner.fail(
      `Failed to cleanup: ${error instanceof Error ? error.message : error}`
    );
    process.exit(1);
  }
}

async function cleanupAll(force?: boolean) {
  const workers = getAllWorkers();

  if (workers.length === 0) {
    console.log(chalk.dim("No workers to clean up."));
    return;
  }

  if (!force) {
    console.log(chalk.yellow(`\nThis will remove ${workers.length} worker(s):\n`));
    for (const worker of workers) {
      console.log(`  - ${chalk.cyan(worker.name)} (${worker.branch})`);
    }
    console.log(`\nRun with ${chalk.cyan("--force")} to confirm.`);
    return;
  }

  const spinner = ora(`Cleaning up ${workers.length} workers...`).start();

  let cleaned = 0;
  let failed = 0;

  for (const worker of workers) {
    try {
      // Try to close iTerm tab
      if (worker.terminalTab) {
        try {
          await sendToItermSession(worker.terminalTab, "\\x03");
          await new Promise((r) => setTimeout(r, 200));
          await closeItermTab(worker.terminalTab);
        } catch {
          // Ignore
        }
      }

      // Delete directory
      if (existsSync(worker.directory)) {
        try {
          rmSync(worker.directory, { recursive: true, force: true, maxRetries: 3 });
        } catch {
          const { execSync } = await import("child_process");
          execSync(`rm -rf "${worker.directory}"`, { stdio: "pipe" });
        }
      }

      removeWorker(worker.id);
      cleaned++;
    } catch {
      failed++;
    }
  }

  // Clear window ID since all workers are gone
  clearItermWindowId();

  if (failed > 0) {
    spinner.warn(`Cleaned up ${cleaned} workers, ${failed} failed`);
  } else {
    spinner.succeed(`Cleaned up ${cleaned} workers`);
  }
}
