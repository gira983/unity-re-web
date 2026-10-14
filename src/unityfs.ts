// UnityFS bundle header parser — v0.1
// Parses the outer bundle header. Block decompression (LZ4/LZMA/ZSTD) comes in v0.2.

export interface UnityFsHeader {
  version: number;
  unityVersion: string;
  unityRevision: string;
  size: bigint;
  compressedBlocksInfoSize: number;
  uncompressedBlocksInfoSize: number;
  flags: number;
  compression: string;
}

const COMPRESSIONS = ["none", "LZMA", "LZ4", "LZ4HC", "LZ4HC", "LZ4HC", "ZSTD"];

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

  return {
    version, unityVersion, unityRevision, size,
    compressedBlocksInfoSize, uncompressedBlocksInfoSize, flags, compression,
  };
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
