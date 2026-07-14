import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AppConfig {
  projects: string[]; // List of absolute folder paths
  githubToken?: string;
  githubUser?: {
    username: string;
    avatarUrl?: string;
  };
}

const CONFIG_DIR = path.join(os.homedir(), '.config', 'dev-dropbox');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function loadConfig(): AppConfig {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    if (!fs.existsSync(CONFIG_FILE)) {
      const initial: AppConfig = { projects: [] };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data) as AppConfig;
  } catch (e) {
    console.error('Failed to load configuration:', e);
    return { projects: [] };
  }
}

export function saveConfig(config: AppConfig): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save configuration:', e);
  }
}
