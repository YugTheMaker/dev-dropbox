import chokidar from 'chokidar';
import { getProjectStatus } from 'core';

export class FolderWatcher {
  private watchers = new Map<string, chokidar.FSWatcher>();
  private statusCallbacks = new Set<(status: any) => void>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  onStatusChange(callback: (status: any) => void) {
    this.statusCallbacks.add(callback);
  }

  removeStatusCallback(callback: (status: any) => void) {
    this.statusCallbacks.delete(callback);
  }

  watchFolder(folderPath: string) {
    if (this.watchers.has(folderPath)) return;

    // Set up chokidar to ignore .git, node_modules, dist, etc.
    const watcher = chokidar.watch(folderPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.DS_Store',
        '**/Thumbs.db'
      ],
      persistent: true,
      ignoreInitial: true // Only watch for changes while running
    });

    const triggerUpdate = () => {
      // Debounce git status calls by 500ms to group multiple file updates
      if (this.debounceTimers.has(folderPath)) {
        clearTimeout(this.debounceTimers.get(folderPath)!);
      }

      const timer = setTimeout(async () => {
        try {
          const status = await getProjectStatus(folderPath);
          for (const callback of this.statusCallbacks) {
            callback(status);
          }
        } catch (e) {
          console.error(`Failed to update status for ${folderPath}:`, e);
        } finally {
          this.debounceTimers.delete(folderPath);
        }
      }, 500);

      this.debounceTimers.set(folderPath, timer);
    };

    watcher.on('add', triggerUpdate);
    watcher.on('change', triggerUpdate);
    watcher.on('unlink', triggerUpdate);
    watcher.on('addDir', triggerUpdate);
    watcher.on('unlinkDir', triggerUpdate);

    this.watchers.set(folderPath, watcher);
    console.log(`Started watching folder: ${folderPath}`);
  }

  unwatchFolder(folderPath: string) {
    const watcher = this.watchers.get(folderPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(folderPath);
      console.log(`Stopped watching folder: ${folderPath}`);
    }

    if (this.debounceTimers.has(folderPath)) {
      clearTimeout(this.debounceTimers.get(folderPath)!);
      this.debounceTimers.delete(folderPath);
    }
  }

  closeAll() {
    for (const [path, watcher] of this.watchers.entries()) {
      watcher.close();
      console.log(`Closed watcher for: ${path}`);
    }
    this.watchers.clear();
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}
