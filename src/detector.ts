import {
  looksLikeUnityFs, parseUnityFs,
  looksLikeIl2CppMetadata, parseIl2CppMetadata,
} from "./unityfs";

export interface Detected {
  title: string;
}

export function detect(buf: ArrayBuffer): Detected | null {
  if (looksLikeUnityFs(buf)) return { title: "UnityFS bundle" };
  if (looksLikeIl2CppMetadata(buf)) return { title: "Il2Cpp global-metadata.dat" };
  return null;
}

export function describe(buf: ArrayBuffer, info: Detected): [string, string][] {
  if (info.title === "UnityFS bundle") {
    const h = parseUnityFs(buf);
    const sizeGb = Number(h.size) / 1024 ** 3;
    const sizeStr = sizeGb >= 1 ? `${sizeGb.toFixed(2)} GB` : `${(Number(h.size) / 1024).toFixed(1)} KB`;
    return [
      ["bundle format version", String(h.version)],
      ["Unity version", h.unityVersion],
      ["Unity revision", h.unityRevision],
      ["bundle size (header says)", sizeStr],
      ["blocks info compression", h.compression],
      ["flags", `0x${h.flags.toString(16)}`],
      ["next step", "v0.2: block decompression → список файлов внутри"],
    ];
  }
  if (info.title === "Il2Cpp global-metadata.dat") {
    const m = parseIl2CppMetadata(buf);
    return [
      ["magic", "0xFAB11BAF ✓"],
      ["metadata version", String(m.version)],
      ["hint", `версия ${m.version} ≈ Unity 2019–6.x (чем выше, тем новее)`],
      ["next step", "v0.3: дерево строк → C# классов"],
    ];
  }
  return [];
}
