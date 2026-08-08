const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

const els = {
  aspect: document.getElementById("aspect"),
  zoom: document.getElementById("zoom"),
  zoomVal: document.getElementById("zoomVal"),
  brightness: document.getElementById("brightness"),
  brightnessVal: document.getElementById("brightnessVal"),
  contrast: document.getElementById("contrast"),
  contrastVal: document.getElementById("contrastVal"),
  saturate: document.getElementById("saturate"),
  saturateVal: document.getElementById("saturateVal"),
  sharpen: document.getElementById("sharpen"),
  sharpenVal: document.getElementById("sharpenVal"),
  resetBtn: document.getElementById("resetBtn"),
  copyBtn: document.getElementById("copyBtn"),
  autoNormal: document.getElementById("autoNormal"),
  autoVivid: document.getElementById("autoVivid"),
  autoSharp: document.getElementById("autoSharp"),
  tryOriginal: document.getElementById("tryOriginal"),
  manualUrl: document.getElementById("manualUrl"),
  loadManualUrl: document.getElementById("loadManualUrl"),
};

const DISPLAY_WIDTH = 640;

let img = null;
let aspectRatio = 1.777;
let outputWidth = 1600;
let zoom = 1;
let panX = 0; // fraction of frame width, 0 = centered
let panY = 0;
let brightness = 100;
let contrast = 100;
let saturate = 100;
let sharpen = 0;

let dragging = false;
let dragStartClientX = 0;
let dragStartClientY = 0;
let dragStartPanX = 0;
let dragStartPanY = 0;

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", !!isError);
}

function parseAspectOption(value) {
  const [ratio, width] = value.split(":");
  return { ratio: parseFloat(ratio), width: parseInt(width, 10) };
}

function applyAspectSelection() {
  const parsed = parseAspectOption(els.aspect.value);
  aspectRatio = parsed.ratio;
  outputWidth = parsed.width;
  canvas.width = DISPLAY_WIDTH;
  canvas.height = Math.round(DISPLAY_WIDTH / aspectRatio);
  clampPan();
  render();
}

/**
 * Toa do ve anh vao 1 khung kich thuoc W x H bat ky (dung chung cho canvas
 * hien thi 640px lan canvas xuat anh that o outputWidth) — giu transform
 * (zoom/pan) tinh theo ty le khung nen doc lap voi do phan giai xuat ra.
 */
function computeDrawFor(W, H) {
  const baseScale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const scale = baseScale * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = (W - dw) / 2 + panX * W;
  const dy = (H - dh) / 2 + panY * H;
  return { dx, dy, dw, dh };
}

function clampPan() {
  if (!img) return;
  const { dw, dh } = computeDrawFor(canvas.width, canvas.height);
  const maxPanX = dw > canvas.width ? (dw - canvas.width) / 2 / canvas.width : 0;
  const maxPanY = dh > canvas.height ? (dh - canvas.height) / 2 / canvas.height : 0;
  panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
  panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
}

function filterString() {
  return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
}

/** Convolution 3x3 don gian dung cho sharpen (unsharp-ish), giu alpha nguyen. */
function applySharpenOn(targetCtx, W, H, amountPercent) {
  if (amountPercent <= 0) return;
  const amount = (amountPercent / 100) * 1.2;
  const kernel = [0, -amount, 0, -amount, 1 + 4 * amount, -amount, 0, -amount, 0];
  const imageData = targetCtx.getImageData(0, 0, W, H);
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const outIdx = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const sx = Math.min(W - 1, Math.max(0, x + kx));
            const sy = Math.min(H - 1, Math.max(0, y + ky));
            sum += src[(sy * W + sx) * 4 + c] * kernel[k];
            k++;
          }
        }
        out[outIdx + c] = sum;
      }
      out[outIdx + 3] = src[outIdx + 3];
    }
  }
  targetCtx.putImageData(new ImageData(out, W, H), 0, 0);
}

function render() {
  if (!img) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.filter = filterString();
  const { dx, dy, dw, dh } = computeDrawFor(canvas.width, canvas.height);
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  applySharpenOn(ctx, canvas.width, canvas.height, sharpen);
}

function resetTransform() {
  zoom = 1;
  panX = 0;
  panY = 0;
  els.zoom.value = 100;
  els.zoomVal.textContent = "100";
}

function resetAll() {
  resetTransform();
  brightness = 100;
  contrast = 100;
  saturate = 100;
  sharpen = 0;
  els.brightness.value = 100;
  els.brightnessVal.textContent = "100";
  els.contrast.value = 100;
  els.contrastVal.textContent = "100";
  els.saturate.value = 100;
  els.saturateVal.textContent = "100";
  els.sharpen.value = 0;
  els.sharpenVal.textContent = "0";
  render();
}

async function fetchImageBlob(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const blob = await res.blob();
  // Anh loi/bi Google tu choi kich thuoc lon thuong tra ve 1 file rat nho
  // (placeholder) — coi la that bai de rot xuong ung vien ke tiep.
  if (blob.size < 3000) throw new Error("ảnh trả về quá nhỏ, có thể bị chặn kích thước này");
  return blob;
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("không đọc được dữ liệu ảnh"));
    image.src = objUrl;
  });
}

/**
 * Thu tai lan luot theo danh sach uu tien (lon nhat truoc) — dung ban dau
 * tien tai thanh cong duoc, bao trang thai cho biet da lay ban nao.
 */
async function loadImage(urlOrList) {
  const list = Array.isArray(urlOrList) ? urlOrList : [urlOrList];
  setStatus("Đang tải ảnh (thử bản chất lượng cao nhất trước)...", false);
  for (let i = 0; i < list.length; i++) {
    try {
      const blob = await fetchImageBlob(list[i]);
      const image = await blobToImage(blob);
      img = image;
      resetTransform();
      clampPan();
      render();
      setStatus(
        i === 0
          ? "Đã tải ảnh chất lượng cao nhất."
          : `Bản chất lượng cao nhất không tải được — đã dùng phương án dự phòng (${i + 1}/${list.length}).`,
        false,
      );
      return;
    } catch {
      // thu tiep ung vien ke tiep trong danh sach
    }
  }
  setStatus(
    'Không tải được ảnh ở mọi kích thước đã thử — thử "Dùng link ảnh gốc" hoặc dán URL khác bên dưới.',
    true,
  );
}

/** Lay histogram do sang cua vung dang framed hien tai (khong filter) de tinh auto mode. */
function sampleLuminanceRange() {
  const W = 160;
  const H = Math.max(1, Math.round(W / aspectRatio));
  const tmp = document.createElement("canvas");
  tmp.width = W;
  tmp.height = H;
  const tctx = tmp.getContext("2d");
  const { dx, dy, dw, dh } = computeDrawFor(W, H);
  tctx.drawImage(img, dx, dy, dw, dh);
  const data = tctx.getImageData(0, 0, W, H).data;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const l = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[l]++;
  }
  const total = W * H;
  let cum = 0;
  let low = 0;
  let high = 255;
  for (let v = 0; v < 256; v++) {
    cum += hist[v];
    if (cum / total >= 0.01) {
      low = v;
      break;
    }
  }
  cum = 0;
  for (let v = 255; v >= 0; v--) {
    cum += hist[v];
    if (cum / total >= 0.01) {
      high = v;
      break;
    }
  }
  return { low, high };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function applyAutoMode(mode) {
  if (!img) return;
  const { low, high } = sampleLuminanceRange();
  const mid = (low + high) / 2;
  let b = clamp(100 + ((128 - mid) / 128) * 50, 60, 150);
  let c = clamp((255 / Math.max(high - low, 1)) * 100, 100, 180);
  let s = 100;
  let sh = 0;

  if (mode === "vivid") {
    s = 130;
    c = Math.min(c + 10, 190);
  }
  if (mode === "sharp") {
    sh = 60;
  }

  brightness = Math.round(b);
  contrast = Math.round(c);
  saturate = Math.round(s);
  sharpen = sh;
  els.brightness.value = brightness;
  els.brightnessVal.textContent = brightness;
  els.contrast.value = contrast;
  els.contrastVal.textContent = contrast;
  els.saturate.value = saturate;
  els.saturateVal.textContent = saturate;
  els.sharpen.value = sharpen;
  els.sharpenVal.textContent = sharpen;
  render();
}

function triggerDownload(sourceCanvas) {
  const a = document.createElement("a");
  a.download = "anh-dichoithoi.png";
  a.href = sourceCanvas.toDataURL("image/png");
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function copyImage() {
  if (!img) {
    setStatus("Chưa có ảnh để copy.", true);
    return;
  }
  const outputHeight = Math.round(outputWidth / aspectRatio);
  const out = document.createElement("canvas");
  out.width = outputWidth;
  out.height = outputHeight;
  const octx = out.getContext("2d");
  octx.filter = filterString();
  const { dx, dy, dw, dh } = computeDrawFor(outputWidth, outputHeight);
  octx.drawImage(img, dx, dy, dw, dh);
  applySharpenOn(octx, outputWidth, outputHeight, sharpen);

  out.toBlob(async (blob) => {
    if (!blob) {
      setStatus("Không tạo được ảnh xuất ra.", true);
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("Đã copy — chuyển qua tab CMS (?tab=images) và dán (Ctrl+V) vào khung ảnh.", false);
    } catch (err) {
      setStatus(`Copy vào clipboard thất bại: ${err.message} — đã tải ảnh xuống thay thế.`, true);
      triggerDownload(out);
    }
  }, "image/png");
}

// --- wiring ---

els.aspect.addEventListener("change", applyAspectSelection);

els.zoom.addEventListener("input", () => {
  zoom = Number(els.zoom.value) / 100;
  els.zoomVal.textContent = els.zoom.value;
  clampPan();
  render();
});

els.brightness.addEventListener("input", () => {
  brightness = Number(els.brightness.value);
  els.brightnessVal.textContent = brightness;
  render();
});

els.contrast.addEventListener("input", () => {
  contrast = Number(els.contrast.value);
  els.contrastVal.textContent = contrast;
  render();
});

els.saturate.addEventListener("input", () => {
  saturate = Number(els.saturate.value);
  els.saturateVal.textContent = saturate;
  render();
});

els.sharpen.addEventListener("input", () => {
  sharpen = Number(els.sharpen.value);
  els.sharpenVal.textContent = sharpen;
  render();
});

els.resetBtn.addEventListener("click", resetAll);
els.copyBtn.addEventListener("click", copyImage);
els.autoNormal.addEventListener("click", () => applyAutoMode("normal"));
els.autoVivid.addEventListener("click", () => applyAutoMode("vivid"));
els.autoSharp.addEventListener("click", () => applyAutoMode("sharp"));

canvas.addEventListener("mousedown", (e) => {
  if (!img) return;
  dragging = true;
  dragStartClientX = e.clientX;
  dragStartClientY = e.clientY;
  dragStartPanX = panX;
  dragStartPanY = panY;
});

window.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  panX = dragStartPanX + (e.clientX - dragStartClientX) / rect.width;
  panY = dragStartPanY + (e.clientY - dragStartClientY) / rect.height;
  clampPan();
  render();
});

window.addEventListener("mouseup", () => {
  dragging = false;
});

canvas.addEventListener(
  "wheel",
  (e) => {
    if (!img) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const newZoomPercent = clamp(Number(els.zoom.value) * factor, 100, 500);
    els.zoom.value = Math.round(newZoomPercent);
    zoom = newZoomPercent / 100;
    els.zoomVal.textContent = Math.round(newZoomPercent);
    clampPan();
    render();
  },
  { passive: false },
);

els.tryOriginal.addEventListener("click", () => {
  if (lastOrigUrl) loadImage(lastOrigUrl);
});

els.loadManualUrl.addEventListener("click", () => {
  const url = els.manualUrl.value.trim();
  if (url) loadImage(url);
});

// Cua so nay duoc giu mo — moi lan nguoi dung bam anh khac tren tab Maps,
// background.js chuyen tiep anh do qua day de nap lai, khong can mo cua so moi.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "gmic-load-image" && message.candidates) {
    lastOrigUrl = message.orig || message.candidates[message.candidates.length - 1];
    loadImage(message.candidates);
  }
});

/**
 * Dan (Ctrl+V) anh tu bat ky nguon nao — screenshot, anh copy tu web khac...
 * — khong chi rieng Google Maps. Dung chung toan bo pipeline crop/filter/
 * copy sau do, chi khac diem nap: tu Blob thay vi fetch URL.
 */
document.addEventListener("paste", (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  const item = Array.from(items).find((it) => it.type.startsWith("image/"));
  if (!item) return;
  e.preventDefault();
  const blob = item.getAsFile();
  if (!blob) return;

  setStatus("Đang dán ảnh từ clipboard...", false);
  blobToImage(blob)
    .then((image) => {
      img = image;
      lastOrigUrl = null; // anh dan tu clipboard, khong co URL goc de fallback
      resetTransform();
      clampPan();
      render();
      setStatus("Đã dán ảnh từ clipboard.", false);
    })
    .catch((err) => setStatus(`Dán ảnh lỗi: ${err.message}`, true));
});

// --- init ---

applyAspectSelection();
const initParams = new URLSearchParams(location.search);
let lastOrigUrl = initParams.get("orig") || null;
const candidatesParam = initParams.get("candidates");
const initialCandidates = candidatesParam ? JSON.parse(candidatesParam) : null;
if (initialCandidates && initialCandidates.length > 0) {
  if (!lastOrigUrl) lastOrigUrl = initialCandidates[initialCandidates.length - 1];
  loadImage(initialCandidates);
} else {
  setStatus(
    "Đang chờ — sang tab Google Maps rồi bấm nút cắt ảnh, hoặc Ctrl+V để dán ảnh từ clipboard.",
    false,
  );
}
