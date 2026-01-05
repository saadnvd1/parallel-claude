# parallel-claude

CLI tool to spawn multiple Claude Code agents across repos with iTerm2 integration. Run parallel AI-assisted development workflows by managing multiple independent workers, each with its own git branch and dev server.

## Features

- **Parallel Workers** - Spawn multiple Claude Code instances working on different tasks simultaneously
- **Automatic Git Setup** - Each worker gets its own feature branch with proper naming conventions
- **iTerm2 Integration** - Split panes with dev server on the left and Claude Code on the right
- **Port Management** - Automatic port assignment to avoid conflicts between workers
- **State Persistence** - Track all active workers and resume workflows
- **Private Repo Support** - Works with `GITHUB_TOKEN` for private repositories

## Prerequisites

- **macOS** with [iTerm2](https://iterm2.com/) installed
- **Node.js** 18+
- **Claude Code** CLI installed (`npm install -g @anthropic-ai/claude-code`)

## Installation

```bash
# Clone the repository
git clone https://github.com/saadnvd1/parallel-claude
cd parallel-claude

# Install dependencies and link globally
npm install
npm run link
```

This makes both `parallel-claude` and `pc` commands available globally.

## Usage

### Spawn a Worker

Create a worker to tackle a specific task:

```bash
parallel-claude spawn https://github.com/user/repo -t "Implement dark mode toggle"
```

This will:
1. Clone the repo to `~/.parallel-claude/workers/<worker-name>`
2. Create a feature branch (e.g., `feat/implement-dark-mode-toggle-swift-fox-0104`)
3. Install dependencies
4. Open iTerm2 with split panes (dev server + Claude Code)
5. Automatically send the task to Claude

### Spawn Multiple Workers

Run multiple tasks in parallel by passing multiple `-t` flags:

```bash
parallel-claude spawn https://github.com/user/repo \
  -t "Add user authentication" \
  -t "Create dashboard page" \
  -t "Setup database migrations"
```

Each task gets its own worker with an isolated branch and dev server port.

### List Workers

View all active workers:

```bash
parallel-claude list
# or
parallel-claude ls
```

Shows worker name, status, repo, branch, port, and task.

### Focus on a Worker

Bring a worker's iTerm tab to the foreground:

```bash
parallel-claude focus swift-fox
```

### Cleanup Workers

Remove a specific worker:

```bash
parallel-claude cleanup swift-fox
# or
parallel-claude rm swift-fox
```

Remove all workers:

```bash
parallel-claude cleanup --all
# or with force (no confirmation)
parallel-claude cleanup --all --force
```

## Command Reference

### `spawn <repo-url>`

Clone a repository and spawn worker(s).

| Option | Description |
|--------|-------------|
| `-t, --task <task...>` | Task description(s) for Claude (required) |
| `-b, --branch <branch>` | Git branch name (auto-generated if not provided) |
| `-p, --port <port>` | Dev server port (auto-assigned from 3100+) |
| `-n, --name <name>` | Worker name (auto-generated like "swift-fox") |
| `--no-dev` | Skip starting the dev server |

### `list` / `ls`

Display all active workers with their status and details.

### `focus <name>`

Focus on a specific worker's iTerm tab.

### `cleanup [name]` / `rm [name]`

Remove worker(s) and clean up resources.

| Option | Description |
|--------|-------------|
| `--all` | Remove all workers |
| `--force` | Skip confirmation prompt |

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub personal access token for private repositories |

### Storage Locations

- **Workers directory**: `~/.parallel-claude/workers/`
- **State file**: `~/.parallel-claude/state.json`

### Port Assignment

Workers are assigned ports starting at 3100, incrementing by 10 for each worker (3100, 3110, 3120, etc.).

## How It Works

1. **Worker Creation**: Each worker gets a unique name (adjective + animal, e.g., "swift-fox")
2. **Repository Setup**: Shallow clone with git configured for the worker identity
3. **Branch Management**: Auto-generates feature branches following conventional naming
4. **Environment**: Copies `.env.local` if present, detects package manager (npm/yarn/pnpm/bun)
5. **iTerm2 Automation**: Uses AppleScript to create split panes and manage sessions
6. **Task Delivery**: Automatically sends the task to Claude Code after a brief startup delay

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Run directly
npm start
```

## License

MIT
