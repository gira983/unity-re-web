import { detect, describe } from "./detector";

const drop = document.getElementById("drop") as HTMLDivElement;
const fileInput = document.getElementById("file") as HTMLInputElement;
const results = document.getElementById("results") as HTMLDivElement;
const logEl = document.getElementById("log");

function esc(s: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return s.replace(/[&<>"']/g, c => map[c] ?? c);
}

function log(msg: string) {
  if (!logEl) return;
  const t = new Date().toLocaleTimeString();
  logEl.innerHTML += `<div>[${t}] ${esc(msg)}</div>`;
  logEl.scrollTop = logEl.scrollHeight;
}
(window as unknown as Record<string, unknown>).__log = log;

window.addEventListener("error", e => log(`JS ERROR: ${e.message} @${e.filename}:${e.lineno}`));
window.addEventListener("unhandledrejection", e => log(`PROMISE REJECT: ${String(e.reason)}`));

// inside the iOS shell the picker is opened through a native message
const nativePicker = (window as unknown as Record<string, { messageHandlers: Record<string, unknown> }> | undefined)
  ?.webkit?.messageHandlers?.["openFilePicker"] as { postMessage: (m: unknown) => void } | undefined;

const status = document.getElementById("status");
if (status) status.textContent += nativePicker ? " · native bridge ✓" : " · browser mode";
log(`boot: bridge=${nativePicker ? "yes" : "no"} ua=${navigator.userAgent.slice(0, 60)}`);

drop.addEventListener("click", () => {
  log("tap on drop zone");
  if (nativePicker) {
    log("-> asking native shell to open picker…");
    nativePicker.postMessage(null);
    return;
  }
  log("-> html input click");
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files?.[0]) {
    log(`input change: ${fileInput.files[0].name}`);
    handleFile(fileInput.files[0]);
  }
});

["dragenter", "dragover"].forEach(ev =>
  drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); })
);
["dragleave", "drop"].forEach(ev =>
  drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); })
);
drop.addEventListener("drop", e => {
  const f = e.dataTransfer?.files?.[0];
  if (f) {
    log(`drop: ${f.name}`);
    handleFile(f);
  }
});

function processFile(name: string, buf: ArrayBuffer) {
  log(`processing ${name} (${buf.byteLength} bytes)`);
  results.innerHTML = "";
  const card = (title: string, rows: [string, string][], ok = true) => {
    results.innerHTML += `
      <div class="card">
        <h2>${esc(title)}</h2>
        <table>${rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v ${ok ? "" : "err"}">${esc(v)}</td></tr>`).join("")}</table>
      </div>`;
  };
  try {
    const info = detect(buf);
    if (!info) {
      card(name, [["result", "Формат не распознан — пока знаем UnityFS-бандлы и global-metadata.dat"]], false);
      log("detect: unknown format");
      return;
    }
    card(info.title, describe(buf, info), true);
    log(`detect: ${info.title} ✓`);
  } catch (e) {
    card("Error", [["parse", String(e)]], false);
    log(`parse error: ${String(e)}`);
  }
}

function handleFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => processFile(file.name, reader.result as ArrayBuffer);
  reader.onerror = () => log(`read error: ${String(reader.error)}`);
  reader.readAsArrayBuffer(file);
}

// Native bridge (iOS shell): document picker files arrive over reweb-file://
(window as unknown as Record<string, unknown>).__nativeFilesPicked = (
  payload: { tokens: string[]; names: string[] },
) => {
  log(`native pick: ${payload.names.join(", ")}`);
  payload.tokens.forEach((token, i) => {
    const name = payload.names[i];
    log(`fetching ${name} via bridge…`);
    fetch(`reweb-file://${token}/${encodeURIComponent(name)}`)
      .then(r => {
        log(`bridge response: ${r.status}`);
        return r.arrayBuffer();
      })
      .then(buf => processFile(name, buf))
      .catch(e => {
        log(`bridge fetch FAILED: ${String(e)}`);
        results.innerHTML = `<div class="card"><h2 class="err">Ошибка</h2><table><tr><td class="v err">${esc(String(e))}</td></tr></table></div>`;
      });
  });
};
