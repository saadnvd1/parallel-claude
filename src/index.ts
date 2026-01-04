#!/usr/bin/env node

import { program } from "commander";
import { spawn } from "./commands/spawn.js";
import { list } from "./commands/list.js";
import { cleanup } from "./commands/cleanup.js";

program
  .name("parallel-claude")
  .description("Spawn multiple Claude Code agents across repos with iTerm2 integration")
  .version("1.0.0");

program
  .command("spawn <repo-url>")
  .description("Clone a repo and start Claude Code in a new iTerm2 window")
  .requiredOption("-t, --task <task...>", "Task description(s) for Claude (use multiple -t for parallel workers)")
  .option("-b, --branch <branch>", "Branch name (auto-generated if not provided)")
  .option("-p, --port <port>", "Dev server port (auto-assigned if not provided)", parseInt)
  .option("-n, --name <name>", "Worker name (auto-generated if not provided)")
  .option("--no-dev", "Skip starting the dev server")
  .action(spawn);

program
  .command("list")
  .alias("ls")
  .description("List all active workers")
  .action(list);

program
  .command("cleanup [name]")
  .alias("rm")
  .description("Remove a worker and clean up its directory")
  .option("-a, --all", "Remove all workers")
  .option("-f, --force", "Force removal without confirmation")
  .action(cleanup);

program
  .command("focus <name>")
  .description("Focus on a worker's iTerm2 tab")
  .action(async (name) => {
    const { focusItermSession } = await import("./lib/iterm.js");
    const { getWorker } = await import("./lib/workers.js");
    const worker = getWorker(name);
    if (!worker?.terminalTab) {
      console.error(`Worker not found or no terminal tab: ${name}`);
      process.exit(1);
    }
    await focusItermSession(worker.terminalTab);
  });

program.parse();
