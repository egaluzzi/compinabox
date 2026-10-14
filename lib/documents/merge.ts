export class MergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MergeError";
  }
}

export type MergeValues = Record<string, string>;

const FIELD = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g;

/**
 * Tiny interpolator for {{field}}. Single pass, plain text out (renderers escape), no eval.
 * An unknown or empty field, or a stray "{{" / "}}", throws — a document is never generated
 * with a hole in it.
 */
export function interpolate(template: string, values: MergeValues): string {
  const stray = template.replace(FIELD, "");
  if (stray.includes("{{") || stray.includes("}}"))
    throw new MergeError(`Malformed merge field in: ${template.slice(0, 60)}`);
  return template.replace(FIELD, (_m, name: string) => {
    const v = Object.prototype.hasOwnProperty.call(values, name)
      ? values[name]
      : undefined;
    if (v === undefined)
      throw new MergeError(`Unknown merge field {{${name}}}`);
    if (v.trim() === "")
      throw new MergeError(`Missing value for merge field {{${name}}}`);
    return v;
  });
}
