# ADR 0004: Project Folder Validation Engine

## Context and Problem
If a user adds their entire Home folder (`/Users/username`) or a system directory (like `/usr` or `/System`) to Dev Dropbox, the background file watcher and Git operations would crash, run out of memory, track confidential files (caches, keys), or corrupt files. Additionally, nested Git repositories inside projects could cause confusing sub-repository states.

## Decision
We implement a **Project Validation Engine** before adding any directory:
1.  **Block System & Home Roots**: We resolve the paths and block the user's home folder exactly, or any system directories (like `/`, `/usr`, `C:\Windows`, etc.).
2.  **Warn on Oversized Folders**: We recursively scan the folders. If the file count exceeds 10,000 or the folder size exceeds 500MB, we flag the folder as oversized and warn the user.
3.  **Detect Nested Repositories**: We scan for any subdirectories that contain `.git` folders. If any nested repositories are found, we warn the user.
4.  **Auto-gitignore**: If the directory has no `.gitignore` file, we inspect the root for configuration files (like `package.json`, `Cargo.toml`, or `requirements.txt`) and suggest a standard, production-ready `.gitignore` file to write automatically.

## Consequences
*   **Pros**:
    *   Protects the host system from accidental tracking of root/home directories.
    *   Improves sync performance by automatically ignoring heavy build folders (`node_modules/`, `target/`).
    *   Avoids Git index corruption from nested repositories.
*   **Cons**:
    *   Scanning large folders on initial addition adds a small validation delay (capped by a maximum file search depth of 5 and a file scan limit of 15,000 files to keep it fast).
