import { Readable } from "node:stream";

export type ZipArchiveEntry = {
  path: string;
  data: Buffer;
  date?: Date;
};

type CentralDirectoryRecord = {
  path: Buffer;
  crc32: number;
  size: number;
  offset: number;
  dosTime: number;
  dosDate: number;
};

const CRC32_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC32_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC32_TABLE[index] = value >>> 0;
}

export function createZipArchiveStream(entries: AsyncIterable<ZipArchiveEntry>) {
  return Readable.from(zipChunks(entries));
}

async function* zipChunks(entries: AsyncIterable<ZipArchiveEntry>) {
  const centralDirectory: CentralDirectoryRecord[] = [];
  let offset = 0;

  for await (const entry of entries) {
    const path = Buffer.from(entry.path, "utf8");
    const crc32 = calculateCrc32(entry.data);
    const { dosTime, dosDate } = toDosDateTime(entry.date ?? new Date());
    const localHeader = createLocalHeader(path, crc32, entry.data.length, dosTime, dosDate);
    yield localHeader;
    yield entry.data;
    centralDirectory.push({
      path,
      crc32,
      size: entry.data.length,
      offset,
      dosTime,
      dosDate,
    });
    offset += localHeader.length + entry.data.length;
  }

  const centralStart = offset;
  for (const record of centralDirectory) {
    const header = createCentralDirectoryHeader(record);
    yield header;
    offset += header.length;
  }
  yield createEndOfCentralDirectory(centralDirectory.length, offset - centralStart, centralStart);
}

export function calculateCrc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createLocalHeader(
  path: Buffer,
  crc32: number,
  size: number,
  dosTime: number,
  dosDate: number,
) {
  const header = Buffer.alloc(30 + path.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(dosTime, 10);
  header.writeUInt16LE(dosDate, 12);
  header.writeUInt32LE(crc32, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(path.length, 26);
  header.writeUInt16LE(0, 28);
  path.copy(header, 30);
  return header;
}

function createCentralDirectoryHeader(record: CentralDirectoryRecord) {
  const header = Buffer.alloc(46 + record.path.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(record.dosTime, 12);
  header.writeUInt16LE(record.dosDate, 14);
  header.writeUInt32LE(record.crc32, 16);
  header.writeUInt32LE(record.size, 20);
  header.writeUInt32LE(record.size, 24);
  header.writeUInt16LE(record.path.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(record.offset, 42);
  record.path.copy(header, 46);
  return header;
}

function createEndOfCentralDirectory(entries: number, centralSize: number, centralOffset: number) {
  const footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50, 0);
  footer.writeUInt16LE(0, 4);
  footer.writeUInt16LE(0, 6);
  footer.writeUInt16LE(entries, 8);
  footer.writeUInt16LE(entries, 10);
  footer.writeUInt32LE(centralSize, 12);
  footer.writeUInt32LE(centralOffset, 16);
  footer.writeUInt16LE(0, 20);
  return footer;
}

function toDosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    dosTime:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    dosDate:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}
