/** A user-correctable error that should be shown without a stack trace. */
export class SkillError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SkillError';
  }
}

/** @param {unknown} error */
export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/** @param {string} message */
export function fail(message) {
  throw new SkillError(message);
}
