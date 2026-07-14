# Developer Agent Guidelines (AGENTS.md)

Welcome, AI Coding Assistant! This file documents the rules, patterns, and principles of the Dev Dropbox codebase to help you maintain consistency, design principles, and safety.

## 1. Core Architecture
- **Three-Tier Separation**:
  - Keep Git, folder validation, and host-provider logic strictly inside the `/core` package (standalone TypeScript library). Do not write Node.js imports inside `/src` (Tauri Webview frontend).
  - Use `/daemon` to run file watchers and expose an API for the frontend.
  - The Tauri Rust backend (`/src-tauri`) should only handle windowing, system tray, and daemon process spawning.
- **Node Workspaces**: This is an npm workspaces monorepo. Dependencies should be installed at the root.

## 2. Terminology & UI Guidelines
- **Never display Git CLI commands or raw Git syntax in the UI.**
- Use approachable, simple terms:
  - Git Push / Pull / Fetch / Sync -> **Synchronize** or **Sync**
  - Git Commit / Uncommitted Changes -> **Changes waiting** or **Saved updates**
  - Merge Conflicts -> **Resolving differences** or **Sync issue**
  - Branch -> **Version group** or hide it entirely (default to `main`)
  - Remote -> **Cloud** or **GitHub**
- The UI must look polished, using modern Tailwind styling, rounded corners, subtle gradients, and glassmorphism in dark mode. It should be friendly enough for a 10-year-old but functional for a senior developer.

## 3. Git Safety & Non-Destructive Principles
- **Never perform destructive Git operations**:
  - Do NOT use `--force` or `--force-with-lease` for pushing.
  - Do NOT use `git reset --hard` or `git checkout -f` on user files.
- **Auto-Commit**:
  - Before pulling remote changes, check for uncommitted files. If any exist, automatically commit them with a timestamped message: `Dev Dropbox: Auto-save from <device> on <date/time>`. This ensures the user's work is always saved in a local Git commit, which can be recovered.
- **Conflict Resolution**:
  - When merging results in conflicts, pause the sync operation, set status to `conflicted`, and return the conflict files.
  - The UI must present a simple conflict resolution modal allowing the user to select either "Keep My Copy" (Git `--ours` checkout) or "Keep Cloud Copy" (Git `--theirs` checkout), then stage and finalize the commit.

## 4. Project Validation Engine
- **Blocked Directories**: Prevent tracking the home folder directly (e.g. `/Users/username`) or system directories (`/`, `/usr`, `/Windows`, etc.) to prevent tracking config caches, SSH keys, or breaking systems.
- **Oversized Warning**: Warn when adding directories containing >10,000 files or >500MB.
- **Nested Repos**: Detect and warn about nested `.git` folders.
- **Auto-gitignore**: Always check if a `.gitignore` exists. If not, auto-detect project language (Node, Rust, Python) and write a robust `.gitignore` file.
