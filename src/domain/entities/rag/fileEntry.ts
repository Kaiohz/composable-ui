export class FileEntry {
  readonly objectName: string;
  readonly size: number;
  readonly lastModified: string | null;

  constructor({
    objectName,
    size,
    lastModified,
  }: {
    objectName: string;
    size: number;
    lastModified: string | null;
  }) {
    this.objectName = objectName;
    this.size = size;
    this.lastModified = lastModified;
  }

  get filename(): string {
    const parts = this.objectName.split("/");
    return parts.at(-1) || this.objectName;
  }
}

/**
 * Strip all trailing "/" characters with a linear scan — no regex
 * backtracking on adversarial input (Sonar S8786).
 */
export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.endsWith("/", end)) {
    end -= 1;
  }
  return value.slice(0, end);
}

export class FolderEntry {
  readonly prefix: string;

  constructor({ prefix }: { prefix: string }) {
    this.prefix = prefix;
  }

  get name(): string {
    const trimmed = trimTrailingSlashes(this.prefix);
    const parts = trimmed.split("/");
    return parts.at(-1) || trimmed;
  }
}
