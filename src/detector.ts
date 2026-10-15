import {
  looksLikeUnityFs, parseUnityFs, readBundleContents,
  looksLikeIl2CppMetadata, parseIl2CppMetadata,
} from "./unityfs";

export interface Detected {
  title: string;
}

const MAX_FILES_SHOWN = 50;

export function detect(buf: ArrayBuffer): Detected | null {
  if (looksLikeUnityFs(buf)) return { title: "UnityFS bundle" };
  if (looksLikeIl2CppMetadata(buf)) return { title: "Il2Cpp global-metadata.dat" };
  return null;
}

function fmtSize(n: number | bigint): string {
  const b = Number(n);
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(2)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}

export function describe(buf: ArrayBuffer, info: Detected): [string, string][] {
  if (info.title === "UnityFS bundle") {
    const h = parseUnityFs(buf);
    const rows: [string, string][] = [
      ["bundle format version", String(h.version)],
      ["Unity version", h.unityVersion],
      ["Unity revision", h.unityRevision],
      ["bundle size (header says)", fmtSize(h.size)],
      ["blocks info compression", h.compression],
      ["flags", `0x${h.flags.toString(16)}`],
    ];
    try {
      const c = readBundleContents(buf, h);
      rows.push(["blocks", String(c.blocks.length)]);
      rows.push(["files inside", String(c.nodes.length)]);
      const shown = c.nodes.slice(0, MAX_FILES_SHOWN);
      for (const n of shown) {
        rows.push(["  📄 " + n.name, fmtSize(n.size)]);
      }
      if (c.nodes.length > shown.length) {
        rows.push(["  …", `и ещё ${c.nodes.length - shown.length} файлов`]);
      }
      rows.push(["next step", "v0.3: выгрузка содержимого файлов"]);
    } catch (e) {
      rows.push(["files inside", `ошибка: ${String(e)}`]);
    }
    return rows;
  }
  if (info.title === "Il2Cpp global-metadata.dat") {
    const m = parseIl2CppMetadata(buf);
    return [
      ["magic", "0xFAB11BAF ✓"],
      ["metadata version", String(m.version)],
      ["hint", `версия ${m.version} ≈ Unity 2019–6.x (чем выше, тем новее)`],
      ["next step", "v0.4: дерево строк → C# классов"],
    ];
  }
  return [];
}
