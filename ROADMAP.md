# Dev Dropbox Product Roadmap

Dev Dropbox aims to democratize coding by eliminating Git friction. Here is where we are going:

## Phase 1: MVP Desktop App (Current)
*   [x] Core standalone Git typescript library.
*   [x] File system change watcher and background syncing daemon.
*   [x] Easy Setup Wizard (GitHub PAT & local directories).
*   [x] Folder verification engine (blocks system roots, detects nested repos, warns on oversized folders).
*   [x] Auto-gitignore creator for Node.js, Python, and Rust.
*   [x] Non-destructive automated merge and push sync.
*   [x] Simplified visual conflict resolution ("Keep My Copy" vs "Keep Cloud Copy").

## Phase 2: Collaboration & Extensibility (Q3 2026)
*   **More Cloud Providers**: Integrate GitLab, Bitbucket, and custom SSH git servers.
*   **GitHub Device Flow Auth**: Replace manual PAT copying with standard browser OAuth authorization.
*   **Version History Panel**: A simple, visual time-machine of changes (e.g. "You updated index.ts 2 hours ago. [Restore this version]").
*   **Sync Pausing**: Pause and resume syncing operations globally or for specific projects.

## Phase 3: Advanced Optimization (Q4 2026)
*   **Selective Syncing**: Allow users to exclude heavy directories dynamically from the UI.
*   **Large File Storage (LFS)**: Detect large binary media assets and auto-initialize Git LFS.
*   **Multi-branch Support**: Switch between stable/dev versions of the workspace using a simple "Workspace Settings" dropdown instead of direct branch merges.
*   **Dev Dropbox Mobile**: Real-time project tracking and readme viewing on mobile devices.
