# Contributing to Dev Dropbox

First off, thank you for checking out Dev Dropbox! We want to make Git approachable, simple, and safe for everyone—including kids and absolute beginners.

By contributing, you help make software development accessible to a wider audience.

---

## Code of Conduct

We expect all contributors to follow our [Code of Conduct](CODE_OF_CONDUCT.md) in all community interactions.

## Project Structure

Dev Dropbox is structured as a TypeScript monorepo with a Tauri/Rust desktop wrapper:

*   **`/core`**: Standalone TypeScript library containing Git wrapper, GitHub integrations, and validation engine.
*   **`/daemon`**: Express/WebSocket background server. Handles filesystem watching and schedules auto-syncs.
*   **`/src`**: React + TypeScript + Tailwind CSS frontend.
*   **`/src-tauri`**: Rust desktop app wrapper. Spawns and manages the daemon process.

---

## Local Development Setup

### Prerequisites
1.  **Node.js** (v20+ recommended)
2.  **Git** (installed and in PATH)
3.  **Rust & Cargo** (for Tauri native compilation)

### Getting Started

1.  Clone the repository:
    ```bash
    git clone https://github.com/YugTheMaker/dev-dropbox.git
    cd dev-dropbox
    ```

2.  Install dependencies at the root:
    ```bash
    npm install
    ```

3.  Build the packages in order (Core first, then Daemon):
    ```bash
    npm run build:core
    ```

4.  Start development servers:
    ```bash
    npm run dev
    ```
    This script will concurrently start:
    - Sourcing and compiling the core typescript files.
    - Sourcing and running the daemon.
    - Starting the Vite development server for the frontend.
    - Launching the Tauri desktop application.

---

## Adding New Cloud Hosts

The `/core` package is designed to be extensible. To add a new host (e.g. GitLab, Bitbucket):
1.  Add a new host class in `core/src/hosts/` implementing the `CloudHost` interface from `core/src/types.ts`.
2.  Export it from `core/src/index.ts`.
3.  Update the setup wizard in `/src` to prompt for credentials and configure it.

## Coding Principles

*   **No Git Jargon in Frontend**: Keep all UI texts clean and user-friendly. Never expose Git CLI command output or parameters to the user.
*   **Safety First**: Never perform destructive Git operations (`--force`, `reset --hard`). If a command can overwrite files, it must be double-checked and auto-committed.
*   **Polished Styling**: Use modern Tailwind styling. All new features should adhere to the Outfit font, rounded edges, and dark-mode glassmorphic theme.
