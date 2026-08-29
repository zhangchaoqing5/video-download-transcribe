import { readFile } from 'node:fs/promises';
import { fail } from './errors.mjs';

/**
 * Parse a deliberately small, cross-platform CLI grammar.
 * @param {string[]} argv
 * @param {{name: string, aliases?: string[], type: 'value'|'boolean'|'repeat', default?: unknown}[]} definitions
 */
export function parseCli(argv, definitions) {
  const byFlag = new Map();
  /** @type {Record<string, unknown>} */
  const options = {};
  for (const definition of definitions) {
    options[definition.name] = definition.type === 'repeat' ? [] : definition.default;
    byFlag.set(`--${definition.name}`, definition);
    for (const alias of definition.aliases ?? []) byFlag.set(alias, definition);
  }

  /** @type {string[]} */
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (!token.startsWith('-') || token === '-') {
      positionals.push(token);
      continue;
    }

    const equalsIndex = token.indexOf('=');
    const flag = equalsIndex === -1 ? token : token.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : token.slice(equalsIndex + 1);
    const definition = byFlag.get(flag);
    if (!definition) fail(`未知选项：${flag}`);

    if (definition.type === 'boolean') {
      if (inlineValue !== undefined) fail(`${flag} 不接受值。`);
      options[definition.name] = true;
      continue;
    }

    const value = inlineValue ?? argv[index + 1];
    if (value === undefined || value.length === 0) fail(`${flag} 需要一个值。`);
    if (inlineValue === undefined) index += 1;
    if (definition.type === 'repeat') {
      /** @type {string[]} */ (options[definition.name]).push(value);
    } else {
      options[definition.name] = value;
    }
  }
  return { options, positionals };
}

/** @param {string} filePath */
export async function readUrlFile(filePath) {
  let content;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    fail(`无法读取 URL 文件：${filePath}（${error instanceof Error ? error.message : String(error)}）`);
  }
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/** @param {string[]} urls */
export function requireUrls(urls) {
  if (urls.length === 0) fail('请提供至少一个 URL，或使用 --file。');
  return urls;
}

/** @param {unknown} value @param {string} option @param {{min?: number, max?: number}} [bounds] */
export function integerOption(value, option, { min, max } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || (min !== undefined && number < min) || (max !== undefined && number > max)) {
    const range = min !== undefined && max !== undefined ? ` ${min} 到 ${max}` : '';
    fail(`${option} 必须是${range}的整数。`);
  }
  return number;
}

/** @param {string} value @param {string} option @param {readonly string[]} allowed */
export function enumOption(value, option, allowed) {
  if (!allowed.includes(value)) fail(`${option} 必须是 ${allowed.join('、')}。`);
  return value;
}
