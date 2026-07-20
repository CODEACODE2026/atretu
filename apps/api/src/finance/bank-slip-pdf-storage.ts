import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import { Injectable } from "@nestjs/common";

export type StoredBankSlipPdf = {
  bytes: Buffer;
  sha256: string;
  sizeBytes: number;
};

export type StoreBankSlipPdfInput = {
  bankSlipId: string;
  institutionId: string;
  bytes: Buffer;
};

export type StoreBankSlipPdfResult = {
  storageKey: string;
  sha256: string;
  sizeBytes: number;
};

@Injectable()
export class BankSlipPdfStorage {
  private readonly rootPath: string;

  constructor(rootPath = process.env.BANK_SLIP_PDF_STORAGE_PATH ?? "./storage/private/bank-slips") {
    this.rootPath = resolve(rootPath);
  }

  async store(input: StoreBankSlipPdfInput): Promise<StoreBankSlipPdfResult> {
    const storageKey = this.storageKey(input.institutionId, input.bankSlipId);
    const filePath = this.resolveKey(storageKey);
    await mkdir(filePath.slice(0, filePath.lastIndexOf(sep)), { recursive: true });
    await writeFile(filePath, input.bytes, { flag: "w" });
    return {
      storageKey,
      sha256: sha256(input.bytes),
      sizeBytes: input.bytes.byteLength,
    };
  }

  async read(storageKey: string): Promise<StoredBankSlipPdf> {
    const filePath = this.resolveKey(storageKey);
    const [bytes, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    return {
      bytes,
      sha256: sha256(bytes),
      sizeBytes: Number(fileStat.size),
    };
  }

  storageKey(institutionId: string, bankSlipId: string) {
    return `bank-slips/${this.safeSegment(institutionId)}/${this.safeSegment(bankSlipId)}.pdf`;
  }

  private safeSegment(value: string) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      throw new Error("Invalid bank slip PDF storage identifier");
    }
    return value;
  }

  private resolveKey(storageKey: string) {
    if (storageKey.includes("\0") || storageKey.startsWith("/") || storageKey.includes("..")) {
      throw new Error("Invalid bank slip PDF storage key");
    }
    const normalized = normalize(storageKey);
    const resolved = resolve(this.rootPath, normalized);
    if (resolved !== this.rootPath && !resolved.startsWith(`${this.rootPath}${sep}`)) {
      throw new Error("Invalid bank slip PDF storage key");
    }
    return resolved;
  }
}

export function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}
