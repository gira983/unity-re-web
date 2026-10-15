import { detect, describe } from "./detector";

const drop = document.getElementById("drop") as HTMLDivElement;
const fileInput = document.getElementById("file") as HTMLInputElement;
const results = document.getElementById("results") as HTMLDivElement;

// inside the iOS shell the picker is opened through a native message
const nativePicker = (window as unknown as Record<string, { messageHandlers: Record<string, unknown> }> | undefined)
  ?.webkit?.messageHandlers?.["openFilePicker"] as { postMessage: (m: unknown) => void } | undefined;

const status = document.getElementById("status");
if (status) status.textContent += nativePicker ? " · native bridge ✓" : " · browser mode";

drop.addEventListener("click", () => {
  if (nativePicker) { nativePicker.postMessage(null); return; }
  fileInput.click();
});
fileInput.addEventListener("change", () => {
  if (fileInput.files?.[0]) handleFile(fileInput.files[0]);
});

["dragenter", "dragover"].forEach(ev =>
  drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); })
);
["dragleave", "drop"].forEach(ev =>
  drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); })
);
drop.addEventListener("drop", e => {
  const f = e.dataTransfer?.files?.[0];
  if (f) handleFile(f);
});

function esc(s: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return s.replace(/[&<>"']/g, c => map[c] ?? c);
}

function processFile(name: string, buf: ArrayBuffer) {
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
      return;
    }
    card(info.title, describe(buf, info), true);
  } catch (e) {
    card("Error", [["parse", String(e)]], false);
  }
}

function handleFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => processFile(file.name, reader.result as ArrayBuffer);
  reader.readAsArrayBuffer(file);
}

// Native bridge (iOS shell): document picker files arrive over reweb-file://
(window as unknown as Record<string, unknown>).__nativeFilesPicked = (
  payload: { tokens: string[]; names: string[] },
) => {
  payload.tokens.forEach((token, i) => {
    const name = payload.names[i];
    fetch(`reweb-file://${token}/${encodeURIComponent(name)}`)
      .then(r => r.arrayBuffer())
      .then(buf => processFile(name, buf))
      .catch(e => {
        results.innerHTML = `<div class="card"><h2 class="err">Ошибка</h2><table><tr><td class="v err">${esc(String(e))}</td></tr></table></div>`;
      });
  });
};
