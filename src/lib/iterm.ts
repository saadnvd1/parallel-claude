import { exec } from "child_process";
import { promisify } from "util";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const execAsync = promisify(exec);

/**
 * Run AppleScript command using a temp file to avoid escaping issues
 */
async function runAppleScript(script: string): Promise<string> {
  const tmpFile = join(tmpdir(), `parallel-claude-${Date.now()}.scpt`);
  try {
    writeFileSync(tmpFile, script);
    const { stdout } = await execAsync(`osascript "${tmpFile}"`);
    return stdout.trim();
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Escape string for AppleScript
 */
function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Open a new iTerm2 tab and run a command
 * Returns the tab/session ID for later reference
 */
export async function openItermTab(
  name: string,
  directory: string,
  command: string
): Promise<string> {
  const escapedName = escapeForAppleScript(name);
  const escapedDir = escapeForAppleScript(directory);
  const escapedCmd = escapeForAppleScript(command);

  const script = `
    tell application "iTerm2"
      activate
      tell current window
        create tab with default profile
        tell current session
          set name to "${escapedName}"
          write text "cd ${escapedDir} && ${escapedCmd}"
        end tell
      end tell
      return id of current session of current window
    end tell
  `;

  return runAppleScript(script);
}

/**
 * Open a new iTerm2 window with multiple tabs
 */
export async function openItermWindow(
  name: string,
  directory: string,
  commands: { name: string; command: string }[]
): Promise<string> {
  const escapedDir = escapeForAppleScript(directory);

  // First tab
  const firstCommand = commands[0];
  const firstName = escapeForAppleScript(firstCommand.name);
  const firstCmd = escapeForAppleScript(firstCommand.command);

  let script = `
    tell application "iTerm2"
      activate
      create window with default profile
      tell current window
        tell current session
          set name to "${firstName}"
          write text "cd ${escapedDir} && ${firstCmd}"
        end tell
  `;

  // Additional tabs
  for (let i = 1; i < commands.length; i++) {
    const cmd = commands[i];
    const tabName = escapeForAppleScript(cmd.name);
    const tabCmd = escapeForAppleScript(cmd.command);
    script += `
        create tab with default profile
        tell current session
          set name to "${tabName}"
          write text "cd ${escapedDir} && ${tabCmd}"
        end tell
    `;
  }

  script += `
      end tell
      return id of current window
    end tell
  `;

  return runAppleScript(script);
}

/**
 * Find the parallel-claude workers window by looking for our marker session
 */
async function findWorkersWindow(): Promise<string | null> {
  const script = `
    tell application "iTerm2"
      repeat with w in windows
        repeat with t in tabs of w
          repeat with s in sessions of t
            if name of s starts with "⚡ parallel-claude" then
              return id of w
            end if
          end repeat
        end repeat
      end repeat
      return ""
    end tell
  `;
  const result = await runAppleScript(script);
  return result || null;
}

/**
 * Open a new iTerm2 tab with split panes for a worker
 * Creates vertical split: left = dev server, right = claude
 * Sends the task to Claude after it starts
 *
 * @param isFirstWorker - If true, creates a new window; otherwise finds existing workers window
 */
export async function openWorkerTab(
  workerName: string,
  directory: string,
  devCommand: string | null,
  claudeCommand: string,
  task: string,
  isFirstWorker: boolean = true
): Promise<string> {
  const escapedDir = escapeForAppleScript(directory);
  const escapedClaudeCmd = escapeForAppleScript(claudeCommand);
  const escapedDevCmd = devCommand ? escapeForAppleScript(devCommand) : null;
  const escapedName = escapeForAppleScript(workerName);
  const escapedTask = escapeForAppleScript(task);

  // For subsequent workers, find the existing workers window
  let existingWindowId: string | null = null;
  if (!isFirstWorker) {
    existingWindowId = await findWorkersWindow();
  }

  let script: string;

  if (escapedDevCmd) {
    // Two panes: dev server + claude
    if (existingWindowId) {
      // Add tab to existing workers window
      script = `
        tell application "iTerm2"
          activate
          set targetWindow to window id ${existingWindowId}
          tell targetWindow
            create tab with default profile
            tell current tab
              set name to "${escapedName}"
              tell current session
                set name to "${escapedName} - dev"
                write text "cd ${escapedDir} && ${escapedDevCmd}"

                -- Split vertically for Claude
                set claudeSession to (split vertically with default profile)
                tell claudeSession
                  set name to "${escapedName} - claude"
                  write text "cd ${escapedDir} && ${escapedClaudeCmd}"
                  -- Wait for Claude to start, then send task (write text includes Enter)
                  delay 3
                  write text "${escapedTask}"
                  -- Send extra Enter in case Claude needs confirmation
                  delay 0.5
                  write text ""
                end tell
              end tell
            end tell
          end tell
          return id of targetWindow
        end tell
      `;
    } else {
      // Create new window with marker session
      script = `
        tell application "iTerm2"
          activate
          create window with default profile
          set newWindow to current window
          tell newWindow
            -- First create a marker tab so we can find this window later
            tell current tab
              set name to "⚡ parallel-claude"
              tell current session
                set name to "⚡ parallel-claude"
              end tell
            end tell

            -- Now create the actual worker tab
            create tab with default profile
            tell current tab
              set name to "${escapedName}"
              tell current session
                set name to "${escapedName} - dev"
                write text "cd ${escapedDir} && ${escapedDevCmd}"

                -- Split vertically for Claude
                set claudeSession to (split vertically with default profile)
                tell claudeSession
                  set name to "${escapedName} - claude"
                  write text "cd ${escapedDir} && ${escapedClaudeCmd}"
                  -- Wait for Claude to start, then send task (write text includes Enter)
                  delay 3
                  write text "${escapedTask}"
                  -- Send extra Enter in case Claude needs confirmation
                  delay 0.5
                  write text ""
                end tell
              end tell
            end tell
          end tell
          return id of newWindow
        end tell
      `;
    }
  } else {
    // Single pane: just claude
    if (existingWindowId) {
      script = `
        tell application "iTerm2"
          activate
          set targetWindow to window id ${existingWindowId}
          tell targetWindow
            create tab with default profile
            tell current tab
              set name to "${escapedName}"
              tell current session
                set name to "${escapedName}"
                write text "cd ${escapedDir} && ${escapedClaudeCmd}"
                -- Wait for Claude to start, then send task (write text includes Enter)
                delay 3
                write text "${escapedTask}"
                -- Send extra Enter in case Claude needs confirmation
                delay 0.5
                write text ""
              end tell
            end tell
          end tell
          return id of targetWindow
        end tell
      `;
    } else {
      script = `
        tell application "iTerm2"
          activate
          create window with default profile
          set newWindow to current window
          tell newWindow
            -- First create a marker tab so we can find this window later
            tell current tab
              set name to "⚡ parallel-claude"
              tell current session
                set name to "⚡ parallel-claude"
              end tell
            end tell

            -- Now create the actual worker tab
            create tab with default profile
            tell current tab
              set name to "${escapedName}"
              tell current session
                set name to "${escapedName}"
                write text "cd ${escapedDir} && ${escapedClaudeCmd}"
                -- Wait for Claude to start, then send task (write text includes Enter)
                delay 3
                write text "${escapedTask}"
                -- Send extra Enter in case Claude needs confirmation
                delay 0.5
                write text ""
              end tell
            end tell
          end tell
          return id of newWindow
        end tell
      `;
    }
  }

  return runAppleScript(script);
}

/**
 * Ensure we have a dedicated parallel-claude window, or create one
 */
export async function ensureParallelClaudeWindow(): Promise<void> {
  const script = `
    tell application "iTerm2"
      activate
      -- Just make sure iTerm is running and has a window
      if (count of windows) = 0 then
        create window with default profile
      end if
    end tell
  `;
  await runAppleScript(script);
}

/**
 * Close an iTerm2 tab/session by sending exit command
 */
export async function closeItermTab(sessionId: string): Promise<void> {
  try {
    const script = `
      tell application "iTerm2"
        repeat with w in windows
          repeat with t in tabs of w
            repeat with s in sessions of t
              if id of s is "${sessionId}" then
                tell s to write text "exit"
              end if
            end repeat
          end repeat
        end repeat
      end tell
    `;
    await runAppleScript(script);
  } catch {
    // Session might already be closed
  }
}

/**
 * Send a command to an iTerm2 session
 */
export async function sendToItermSession(
  sessionId: string,
  command: string
): Promise<void> {
  const script = `
    tell application "iTerm2"
      repeat with w in windows
        repeat with t in tabs of w
          repeat with s in sessions of t
            if id of s is "${sessionId}" then
              tell s to write text "${command.replace(/"/g, '\\"')}"
            end if
          end repeat
        end repeat
      end repeat
    end tell
  `;
  await runAppleScript(script);
}

/**
 * Focus on a specific iTerm2 session
 */
export async function focusItermSession(sessionId: string): Promise<void> {
  const script = `
    tell application "iTerm2"
      activate
      repeat with w in windows
        repeat with t in tabs of w
          repeat with s in sessions of t
            if id of s is "${sessionId}" then
              select t
              return
            end if
          end repeat
        end repeat
      end repeat
    end tell
  `;
  await runAppleScript(script);
}

/**
 * Check if iTerm2 is running
 */
export async function isItermRunning(): Promise<boolean> {
  try {
    const script = `
      tell application "System Events"
        return (name of processes) contains "iTerm2"
      end tell
    `;
    const result = await runAppleScript(script);
    return result === "true";
  } catch {
    return false;
  }
}

/**
 * Launch iTerm2 if not running
 */
export async function ensureItermRunning(): Promise<void> {
  const running = await isItermRunning();
  if (!running) {
    await runAppleScript('tell application "iTerm2" to activate');
    // Wait for it to launch
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
