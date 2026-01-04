import chalk from "chalk";
import { getAllWorkers } from "../lib/workers.js";

export function list() {
  const workers = getAllWorkers();

  if (workers.length === 0) {
    console.log(chalk.dim("No active workers."));
    console.log(
      `\nRun ${chalk.cyan("parallel-claude spawn <repo-url> -t <task>")} to create one.`
    );
    return;
  }

  console.log(chalk.bold(`\nActive Workers (${workers.length}):\n`));

  for (const worker of workers) {
    const statusColor =
      worker.status === "running"
        ? chalk.green
        : worker.status === "failed"
          ? chalk.red
          : chalk.yellow;

    console.log(`  ${chalk.cyan(worker.name)} ${statusColor(`[${worker.status}]`)}`);
    console.log(`    ${chalk.dim("Repo:")}     ${worker.repoName}`);
    console.log(`    ${chalk.dim("Branch:")}   ${worker.branch}`);
    console.log(`    ${chalk.dim("Port:")}     ${worker.port}`);
    console.log(`    ${chalk.dim("Task:")}     ${worker.task}`);
    console.log(`    ${chalk.dim("Dir:")}      ${worker.directory}`);
    console.log();
  }

  console.log(
    chalk.dim(`Use ${chalk.cyan("parallel-claude cleanup <name>")} to remove a worker.`)
  );
}
