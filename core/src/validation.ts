import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ValidationResult } from './types.js';

// Blocked paths list (normalized lowercase)
const SYSTEM_PATHS_DARWIN_LINUX = [
  '/',
  '/system',
  '/library',
  '/usr',
  '/bin',
  '/sbin',
  '/var',
  '/etc',
  '/private',
  '/opt',
  '/dev',
  '/proc',
  '/sys',
  '/boot'
];

const SYSTEM_PATHS_WINDOWS = [
  'c:\\',
  'c:\\windows',
  'c:\\program files',
  'c:\\program files (x86)',
  'c:\\windows\\system32'
];

export async function validateProjectFolder(folderPath: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    isHomeOrSystemFolder: false,
    isOversized: false,
    hasNestedRepos: false,
    fileCount: 0,
    totalSizeMb: 0,
    hasGitignore: false
  };

  try {
    const resolvedPath = path.resolve(folderPath);
    const resolvedPathLower = resolvedPath.toLowerCase();

    // 1. Check if it exists and is a directory
    if (!fs.existsSync(resolvedPath)) {
      result.isValid = false;
      result.error = 'Folder does not exist.';
      return result;
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      result.isValid = false;
      result.error = 'Selected path is not a folder.';
      return result;
    }

    // 2. Block Home directory or System folders
    const homeDir = path.resolve(os.homedir());
    const homeDirLower = homeDir.toLowerCase();

    if (resolvedPathLower === homeDirLower) {
      result.isHomeOrSystemFolder = true;
      result.isValid = false;
      result.error = 'Dev Dropbox cannot track your Home folder directly. Please choose a specific project folder inside it.';
      return result;
    }

    // Check system paths
    const isWin = os.platform() === 'win32';
    const systemPaths = isWin ? SYSTEM_PATHS_WINDOWS : SYSTEM_PATHS_DARWIN_LINUX;

    for (const sysPath of systemPaths) {
      const resolvedSys = path.resolve(sysPath).toLowerCase();
      if (resolvedPathLower === resolvedSys || resolvedPathLower.startsWith(resolvedSys + path.sep)) {
        result.isHomeOrSystemFolder = true;
        result.isValid = false;
        result.error = 'Tracking system folders is blocked for safety and performance.';
        return result;
      }
    }

    // Check if the path is in the user's home folder's parent (like `/Users` or `/home`)
    const homeParent = path.dirname(homeDir).toLowerCase();
    if (resolvedPathLower === homeParent) {
      result.isHomeOrSystemFolder = true;
      result.isValid = false;
      result.error = 'Tracking the root users folder is blocked.';
      return result;
    }

    // 3. Scan directory content (nested repos, file size/count, and gitignore status)
    result.hasGitignore = fs.existsSync(path.join(resolvedPath, '.gitignore'));
    
    // Perform safety recursion scan with limit to avoid locking UI
    let fileCount = 0;
    let totalSizeBytes = 0;
    let hasNested = false;
    const maxFilesToScan = 15000; // Limit scan to protect memory

    function scan(dir: string, depth: number = 0) {
      if (fileCount > maxFilesToScan) return;
      if (depth > 5) return; // Limit depth for size scanning

      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file === '.git') {
            if (depth > 0) {
              hasNested = true;
            }
            continue;
          }

          const fullPath = path.join(dir, file);
          let fileStat;
          try {
            fileStat = fs.lstatSync(fullPath);
          } catch {
            continue; // Skip files with read errors
          }

          if (fileStat.isSymbolicLink()) {
            continue; // Skip symlinks to avoid circular reference
          }

          if (fileStat.isDirectory()) {
            const folderName = file.toLowerCase();
            if (
              folderName === 'node_modules' ||
              folderName === 'target' ||
              folderName === 'dist' ||
              folderName === 'build' ||
              folderName === 'out' ||
              folderName === '.venv' ||
              folderName === 'venv' ||
              folderName === 'env' ||
              folderName === '.next' ||
              folderName === '.nuxt' ||
              folderName === '.cache'
            ) {
              continue; // Skip scanning heavy dependency/build directories
            }
            scan(fullPath, depth + 1);
          } else if (fileStat.isFile()) {
            fileCount++;
            totalSizeBytes += fileStat.size;
          }
        }
      } catch (e) {
        // Skip inaccessible subfolders
      }
    }

    scan(resolvedPath);

    result.fileCount = fileCount;
    result.totalSizeMb = parseFloat((totalSizeBytes / (1024 * 1024)).toFixed(2));
    result.hasNestedRepos = hasNested;

    // Hard block folders exceeding 50MB in size
    if (result.totalSizeMb > 50) {
      result.isValid = false;
      result.error = `Folder size (${result.totalSizeMb} MB) exceeds the maximum limit of 50MB. Please ensure heavy dependency or build folders (like node_modules or target) are ignored or choose a smaller project.`;
      return result;
    }

    // Oversized warnings: > 10,000 files
    if (fileCount > 10000) {
      result.isOversized = true;
    }

    // 4. Suggest gitignore if not present
    if (!result.hasGitignore) {
      result.suggestedGitignore = suggestGitignore(resolvedPath);
    }

  } catch (e: any) {
    result.isValid = false;
    result.error = `Folder check failed: ${e.message || e}`;
  }

  return result;
}

function suggestGitignore(projectPath: string): string {
  let content = `# Dev Dropbox Auto-created gitignore\n`;
  content += `# Prevents bloated files from slowing down synchronization\n\n`;
  
  // OS-specific ignores
  content += `# System Files\n`;
  content += `.DS_Store\n`;
  content += `Thumbs.db\n`;
  content += `desktop.ini\n\n`;

  // Detect languages
  const files = fs.readdirSync(projectPath);
  let detectedType = 'generic';

  if (files.includes('package.json')) {
    detectedType = 'Node.js';
    content += `# Node.js\n`;
    content += `node_modules/\n`;
    content += `dist/\n`;
    content += `build/\n`;
    content += `.env\n`;
    content += `.env.local\n`;
    content += `.env.development.local\n`;
    content += `.env.test.local\n`;
    content += `.env.production.local\n`;
    content += `npm-debug.log*\n`;
    content += `yarn-debug.log*\n`;
    content += `yarn-error.log*\n`;
    content += `.eslintcache\n`;
    content += `.next/\n`;
    content += `.nuxt/\n`;
  } else if (files.includes('Cargo.toml')) {
    detectedType = 'Rust';
    content += `# Rust\n`;
    content += `target/\n`;
    content += `**/*.rs.bk\n`;
    content += `Cargo.lock\n`; // Optional for libraries but good to exclude in some settings; we include targets anyway
  } else if (
    files.includes('requirements.txt') || 
    files.includes('Pipfile') || 
    files.includes('pyproject.toml') || 
    files.some(f => f.endsWith('.py'))
  ) {
    detectedType = 'Python';
    content += `# Python\n`;
    content += `__pycache__/\n`;
    content += `*.py[cod]\n`;
    content += `*$py.class\n`;
    content += `.venv/\n`;
    content += `venv/\n`;
    content += `env/\n`;
    content += `.pytest_cache/\n`;
    content += `.tox/\n`;
    content += `.htmlcov/\n`;
  } else {
    // Generic backup
    content += `# General\n`;
    content += `*.log\n`;
    content += `.env\n`;
    content += `tmp/\n`;
    content += `temp/\n`;
  }

  return content;
}

export function writeSuggestedGitignore(projectPath: string, content: string): void {
  const gitignorePath = path.join(projectPath, '.gitignore');
  fs.writeFileSync(gitignorePath, content, 'utf8');
}
