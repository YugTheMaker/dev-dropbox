# ADR 0001: Architecture Overview

## Context and Problem
Dev Dropbox needs to run on macOS, Windows, and Linux. The user interface must be clean, modern, and fluid. The Git logic must be written in TypeScript, using `simple-git`.
However, standard desktop webviews (used by Tauri) do not support Node.js APIs (such as spawning child processes to run the local `git` CLI, or reading/writing files using the `fs` module). 

## Decision
We choose a **Three-Tier Monorepo Architecture**:
1.  **Frontend**: Tauri Webview running React, TypeScript, and Tailwind CSS.
2.  **Daemon**: A local Node.js background process that starts an HTTP Express API and a WebSocket server on localhost port `36911`. It manages file watching and schedules syncs.
3.  **Core Library**: A standalone TypeScript package loaded by the daemon. It uses `simple-git` for local operations, `octokit` for remote communication, and contains the folder validation logic.

```
React (Webview) <--> REST/WS <--> Node Daemon <--> Core Library <--> Git / GitHub
```

## Consequences
*   **Pros**:
    *   Full compatibility with Node packages (`simple-git`, `chokidar`, `ws`).
    *   Background watcher continues working even if the Tauri window is closed.
    *   Clear separation of UI styling and systems engineering logic.
*   **Cons**:
    *   Requires the user to have Node.js installed on their computer (which is standard for the target audience of developers).
    *   Slightly higher memory usage due to running a local Node process.
