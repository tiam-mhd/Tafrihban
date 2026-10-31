import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export interface PrivateStorageProvider {
  put(key: string, bytes: Uint8Array): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export class LocalPrivateStorage implements PrivateStorageProvider {
  private readonly root: string;

  constructor(root = process.env.PRIVATE_STORAGE_DIR || resolve(process.cwd(), ".data", "private")) {
    this.root = resolve(/* turbopackIgnore: true */ root);
  }

  private filePath(key: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid private storage key.");
    const target = resolve(this.root, key);
    const fromRoot = relative(this.root, target);
    if (isAbsolute(fromRoot) || fromRoot.startsWith("..")) throw new Error("Invalid private storage path.");
    return target;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.filePath(key), bytes, { flag: "wx", mode: 0o600 });
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.filePath(key));
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.filePath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export const privateStorage: PrivateStorageProvider = new LocalPrivateStorage();
