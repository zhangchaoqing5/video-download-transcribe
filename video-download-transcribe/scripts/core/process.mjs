import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fail } from './errors.mjs';

/** @param {string} command */
function explicitPath(command) {
  return path.isAbsolute(command) || command.includes('/') || command.includes('\\');
}

/**
 * Validate that an external executable can be started without relying on `which`.
 * @param {string} command
 * @param {string} displayName
 * @param {string[]} [versionArgs]
 */
export async function requireCommand(command, displayName, versionArgs = ['--version']) {
  if (!command) fail(`${displayName} 命令不能为空。`);
  if (explicitPath(command)) {
    const resolved = path.resolve(command);
    try {
      await access(resolved, constants.F_OK);
    } catch {
      fail(`找不到 ${displayName}：${resolved}。请安装后加入 PATH，或传入其路径。`);
    }
    return resolved;
  }

  const result = spawnSync(command, versionArgs, { stdio: 'ignore', windowsHide: true });
  if (result.error) {
    fail(`找不到 ${displayName}：${command}。请安装后加入 PATH，或传入其路径。`);
  }
  return command;
}

/** @param {string} value */
function shellQuote(value) {
  return /[\s"']/u.test(value) ? JSON.stringify(value) : value;
}

/** @param {string} command @param {string[]} args */
export function formatCommand(command, args) {
  return [command, ...args].map(shellQuote).join(' ');
}

/**
 * Run without a shell. By default child output is inherited, preserving tool progress.
 * @param {string} command
 * @param {string[]} args
 * @param {{cwd?: string, onOutput?: (stream: 'stdout'|'stderr', chunk: string) => void, logger?: {log: Function, error: Function}}} [options]
 */
export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const usePipes = Boolean(options.onOutput);
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      stdio: usePipes ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true,
    });
    child.once('error', (error) => reject(error));
    if (usePipes) {
      child.stdout?.on('data', (chunk) => options.onOutput?.('stdout', String(chunk)));
      child.stderr?.on('data', (chunk) => options.onOutput?.('stderr', String(chunk)));
    }
    child.once('close', (code, signal) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} 执行失败：${signal ? `被信号 ${signal} 终止` : `退出码 ${code ?? '未知'}`}。`));
    });
  });
}

/** @template T @param {T[]} values @param {number} limit @param {(value: T, index: number) => Promise<unknown>} worker */
export async function runConcurrent(values, limit, worker) {
  /** @type {Promise<void>[]} */
  const workers = [];
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(values[index], index);
    }
  }
  for (let index = 0; index < Math.min(limit, values.length); index += 1) workers.push(runWorker());
  await Promise.all(workers);
}
