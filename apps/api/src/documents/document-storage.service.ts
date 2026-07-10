import { Inject, Injectable } from "@nestjs/common";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AppConfigService } from "../config/app-config.service.js";

@Injectable()
export class DocumentStorageService {
  private readonly rootDir: string;

  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {
    this.rootDir = path.resolve(this.config.values.documentStorageDir);
  }

  resolveStoragePath(storageKey: string): string {
    const normalizedKey = storageKey.split("/").filter(Boolean).join(path.sep);
    const target = path.resolve(this.rootDir, normalizedKey);
    const relative = path.relative(this.rootDir, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Storage key invalida");
    }
    return target;
  }

  async write(storageKey: string, buffer: Buffer): Promise<void> {
    const target = this.resolveStoragePath(storageKey);
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await fs.writeFile(target, buffer, { flag: "wx", mode: 0o600 });
  }

  async removeIfExists(storageKey: string): Promise<void> {
    try {
      await fs.unlink(this.resolveStoragePath(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async read(storageKey: string): Promise<Buffer> {
    return fs.readFile(this.resolveStoragePath(storageKey));
  }

  getRootDir(): string {
    return this.rootDir;
  }
}
