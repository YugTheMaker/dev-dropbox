# ADR 0003: Non-Destructive Git Synchronization

## Context and Problem
Standard Git operations can be destructive. Actions like `git reset --hard`, `git checkout -f`, or force pushing can lead to permanent data loss for uncommitted files or diverged branches.
Dev Dropbox must guarantee that a user's work is **never lost**, matching the safety model of Dropbox.

## Decision
We implement a strict **non-destructive synchronization workflow**:
1.  **Auto-Commit**: Before any pull or fetch, if there are uncommitted changes (new, edited, or deleted files), we add all files and commit them locally with a timestamped and host-named message: `Dev Dropbox: Auto-save from <device> on <date/time>`.
2.  **Safe Merge Fetch**: Instead of rebasing (which rewrites commits and can lead to complex interactive rewrites), we fetch and run a standard merge: `git merge origin/<branch> --no-edit`. 
3.  **Conflict Handling**: If the merge fails due to conflicts, we catch the error, mark the project status as `conflicted`, and expose the files in conflict. We do not abort the merge automatically.
4.  **Ours/Theirs UI Resolution**: We present the conflicts to the user in a plain-English layout. We offer two choices:
    *   *Keep My Copy*: Runs `git checkout --ours <file>` and stages it.
    *   *Keep Cloud Copy*: Runs `git checkout --theirs <file>` and stages it.
    Once all conflicts are resolved, we finalize the merge commit.
5.  **No Force Pushes**: Pushes to the remote cloud will use standard `git push`. If a push fails, we run the pull/merge cycle again.

## Consequences
*   **Pros**:
    *   User work is always saved in a local Git commit, which acts as a backup.
    *   Merge conflicts are resolved in Git cleanly using standard merge tags.
    *   Eliminates the danger of force pushing or checkout data loss.
*   **Cons**:
    *   Creates frequent automatic commits in the Git log. This is an acceptable trade-off for a Dropbox-like experience.
