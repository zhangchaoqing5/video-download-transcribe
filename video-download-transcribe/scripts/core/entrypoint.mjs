import process from 'node:process';
import { errorMessage } from './errors.mjs';

/** @param {() => Promise<void>} main */
export async function runEntrypoint(main) {
  try {
    await main();
  } catch (error) {
    console.error(`错误：${errorMessage(error)}`);
    process.exitCode = 1;
  }
}
