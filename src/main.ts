import { detect, describe } from "./detector";

const drop = document.getElementById("drop") as HTMLDivElement;
const fileInput = document.getElementById("file") as HTMLInputElement;
const results = document.getElementById("results") as HTMLDivElement;

drop.addEventListener("click", () => fileInput.click());
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

function handleFile(file: File) {
  results.innerHTML = "";
  const reader = new FileReader();
  reader.onload = () => {
    const buf = reader.result as ArrayBuffer;
    const card = (title: string, rows: [string, string][], ok = true) => {
      results.innerHTML += `
        <div class="card">
          <h2>${title}</h2>
          <table>${rows.map(([k, v]) => `<tr><td class="k">${k}</td><td class="v ${ok ? "" : "err"}">${v}</td></tr>`).join("")}</table>
        </div>`;
    };
    try {
      const info = detect(buf);
      if (!info) {
        card("Unknown file", [["result", "Формат не распознан — v0.1 знает UnityFS-бандлы и global-metadata.dat"]], false);
        return;
      }
      card(info.title, describe(buf, info), true);
    } catch (e) {
      card("Error", [["parse", String(e)]], false);
    }
  };
  reader.readAsArrayBuffer(file);
}
