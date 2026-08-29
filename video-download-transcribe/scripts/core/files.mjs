import { access, lstat, mkdir, readdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fail } from './errors.mjs';

/** @param {string} input @param {string} [cwd] */
export function absolutePath(input, cwd = process.cwd()) {
  return path.resolve(cwd, input);
}

/** @param {string} filePath @param {string} description */
export async function requireReadableFile(filePath, description) {
  try {
    const stat = await lstat(filePath);
    if (!stat.isFile()) fail(`${description}不是文件：${filePath}`);
    await access(filePath, constants.R_OK);
  } catch (error) {
    if (error instanceof Error && error.message.includes('不是文件')) throw error;
    fail(`无法读取${description}：${filePath}`);
  }
}

/** @param {string} directory */
export async function ensureDirectory(directory) {
  await mkdir(directory, { recursive: true });
  return directory;
}

/** Write JSON in a single operation so readers do not observe partial text. */
export async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** @param {string} input @param {Set<string>} extensions @param {boolean} recursive */
export async function collectMediaFiles(input, extensions, recursive) {
  let stat;
  try {
    stat = await lstat(input);
  } catch {
    fail(`输入文件或目录不存在：${input}`);
  }

  if (stat.isFile()) {
    if (!extensions.has(path.extname(input).toLowerCase())) fail(`不支持的媒体文件：${input}`);
    return [input];
  }
  if (!stat.isDirectory()) fail(`输入不是文件或目录：${input}`);

  /** @type {string[]} */
  const results = [];
  /** @type {string[]} */
  const pending = [input];
  while (pending.length > 0) {
    const directory = pending.shift();
    if (!directory) continue;
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) results.push(candidate);
      if (recursive && entry.isDirectory()) pending.push(candidate);
    }
  }
  return results;
}
