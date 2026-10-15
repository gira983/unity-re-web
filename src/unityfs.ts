// UnityFS bundle parser — v0.2
// Header + blocksInfo decompression + file (node) listing.
// Extraction of individual node contents lands in v0.3.

import { lz4DecompressBlock } from "./lz4";

export interface UnityFsHeader {
  version: number;
  unityVersion: string;
  unityRevision: string;
  size: bigint;
  compressedBlocksInfoSize: number;
  uncompressedBlocksInfoSize: number;
  flags: number;
  compression: string;
  blocksInfoOffset: number;
}

export interface BundleBlock {
  uncompressedSize: number;
  compressedSize: number;
  flags: number;
}

export interface BundleNode {
  offset: bigint;
  size: bigint;
  flags: number;
  name: string;
}

export interface BundleContents {
  blocks: BundleBlock[];
  nodes: BundleNode[];
}

// compression id = flags & 0x3F; 0x40 = blocksInfo padding; 0x80 = blocksInfo at end
const COMPRESSIONS: Record<number, string> = {
  0: "none",
  1: "LZMA",
  2: "LZ4",
  3: "LZ4HC",
  6: "ZSTD",
};

export function looksLikeUnityFs(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 8) return false;
  return new TextDecoder().decode(new Uint8Array(buf, 0, 7)) === "UnityFS";
}

export function parseUnityFs(buf: ArrayBuffer): UnityFsHeader {
  const dv = new DataView(buf);
  const dec = new TextDecoder();
  let off = 8; // skip "UnityFS\0"

  const readCStr = (): string => {
    const start = off;
    while (dv.getUint8(off) !== 0) off++;
    const s = dec.decode(new Uint8Array(buf, start, off - start));
    off++;
    return s;
  };

  const version = dv.getInt32(off, false); off += 4;
  const unityVersion = readCStr();
  const unityRevision = readCStr();
  const size = dv.getBigUint64(off, false); off += 8;
  const compressedBlocksInfoSize = dv.getUint32(off, false); off += 4;
  const uncompressedBlocksInfoSize = dv.getUint32(off, false); off += 4;
  const flags = dv.getUint32(off, false); off += 4;

  const id = flags & 0x3f;
  const compression = COMPRESSIONS[id] ?? `unknown(${id})`;

  let blocksInfoOffset: number;
  if (flags & 0x80) {
    blocksInfoOffset = Number(size) - compressedBlocksInfoSize;
  } else {
    blocksInfoOffset = off;
    if (flags & 0x40) blocksInfoOffset = (blocksInfoOffset + 15) & ~15; // align to 16
  }

  return {
    version, unityVersion, unityRevision, size,
    compressedBlocksInfoSize, uncompressedBlocksInfoSize, flags, compression,
    blocksInfoOffset,
  };
}

function decompressSection(
  data: Uint8Array,
  compressionId: number,
  uncompressedSize: number,
): Uint8Array {
  switch (compressionId) {
    case 0:
      return data;
    case 2:
    case 3:
      return lz4DecompressBlock(data, uncompressedSize);
    case 1:
      throw new Error("LZMA-сжатие пока не поддерживается (в планах v0.3)");
    case 6:
      throw new Error("ZSTD-сжатие пока не поддерживается (в планах v0.3)");
    default:
      throw new Error(`Неизвестное сжатие: ${compressionId}`);
  }
}

function parseBlocksInfo(
  data: Uint8Array,
  version: number,
  assumeHash: boolean,
): BundleContents | null {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const dec = new TextDecoder();
  let off = assumeHash ? 16 : 0;

  const sane = (n: number) => Number.isInteger(n) && n >= 0 && n <= 1_000_000;

  const blockCount = dv.getInt32(off, false); off += 4;
  if (!sane(blockCount)) return null;
  const blocks: BundleBlock[] = [];
  for (let i = 0; i < blockCount; i++) {
    const uncompressedSize = dv.getUint32(off, false); off += 4;
    const compressedSize = dv.getUint32(off, false); off += 4;
    const flags = dv.getUint16(off, false); off += 2;
    blocks.push({ uncompressedSize, compressedSize, flags });
  }

  const nodeCount = dv.getInt32(off, false); off += 4;
  if (!sane(nodeCount)) return null;
  const nodes: BundleNode[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const offset = dv.getBigInt64(off, false); off += 8;
    const size = dv.getBigInt64(off, false); off += 8;
    const flags = dv.getUint32(off, false); off += 4;
    const start = off;
    while (off < data.length && dv.getUint8(off) !== 0) off++;
    if (off >= data.length) return null;
    const name = dec.decode(new Uint8Array(data.buffer, data.byteOffset + start, off - start));
    off++;
    nodes.push({ offset, size, flags, name });
  }

  // cursor should land at (or very near) the end of the decompressed info
  if (off > data.length || data.length - off > 64) return null;

  return { blocks, nodes };
}

export function readBundleContents(buf: ArrayBuffer, h: UnityFsHeader): BundleContents {
  const infoRaw = new Uint8Array(buf, h.blocksInfoOffset, h.compressedBlocksInfoSize);
  const id = h.flags & 0x3f;
  const info = decompressSection(infoRaw, id, h.uncompressedBlocksInfoSize);

  // v7+ bundles have a 16-byte data hash before the block list; fall back if parse looks wrong
  const parsed =
    parseBlocksInfo(info, h.version, h.version >= 7) ??
    parseBlocksInfo(info, h.version, h.version < 7);
  if (!parsed) throw new Error("Не удалось разобрать blocksInfo (неизвестный вариант формата)");
  return parsed;
}

// global-metadata.dat: magic 0xFAB11BAF (LE), then version (LE int32)
export interface Il2CppMetadataInfo {
  version: number;
}

export function looksLikeIl2CppMetadata(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 8) return false;
  return new DataView(buf).getInt32(0, true) === 0xfab11baf;
}

export function parseIl2CppMetadata(buf: ArrayBuffer): Il2CppMetadataInfo {
  const dv = new DataView(buf);
  return { version: dv.getInt32(4, true) };
}
