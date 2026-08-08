/**
 * Giu id cua so Crop dang mo (chi 1 cai) — click anh moi tren Maps se nap
 * lai vao cua so nay thay vi mo cua so moi moi lan, tranh spam cua so.
 * Trang thai nay cung la nguon su that de bat/tat tracking chuot ben content
 * script: chi khi cua so Crop dang mo moi can content.js theo doi chuot.
 */
let cropWindowId = null;

chrome.windows.onRemoved.addListener((id) => {
  if (id === cropWindowId) {
    cropWindowId = null;
    broadcastActiveState(false);
  }
});

chrome.action.onClicked.addListener(() => {
  focusOrCreateCropWindow(null);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "gmic-image-clicked" && message.src) {
    const candidates = buildCandidateUrls(message.src);
    focusOrCreateCropWindow({ candidates, orig: message.src });
    return;
  }
  if (message?.type === "gmic-query-active") {
    // Content script vua nap trang (F5 / mo tab moi) hoi xem cua so Crop co
    // dang mo san khong, de biet co can bat theo doi chuot ngay hay khong.
    sendResponse({ active: cropWindowId !== null });
  }
});

async function focusOrCreateCropWindow(payload) {
  let opened = false;
  if (cropWindowId !== null) {
    try {
      await chrome.windows.get(cropWindowId);
      if (payload) {
        // Cua so da mo va crop.js dang lang nghe san — day anh moi qua truc tiep.
        chrome.runtime.sendMessage({ type: "gmic-load-image", ...payload }).catch(() => {});
      }
      chrome.windows.update(cropWindowId, { focused: true });
      opened = true;
    } catch {
      cropWindowId = null; // cua so da bi dong tay, tao lai ben duoi
    }
  }

  if (!opened) {
    const params = new URLSearchParams();
    if (payload) {
      params.set("candidates", JSON.stringify(payload.candidates));
      params.set("orig", payload.orig);
    }
    const url =
      chrome.runtime.getURL("crop.html") + (params.toString() ? "?" + params.toString() : "");
    const win = await chrome.windows.create({ url, type: "popup", width: 1000, height: 780 });
    cropWindowId = win.id;
  }

  broadcastActiveState(true);
}

/** Bao cho moi tab Google Maps dang mo biet co nen bat/tat theo doi chuot. */
async function broadcastActiveState(active) {
  const tabs = await chrome.tabs.query({ url: "https://www.google.com/maps*" });
  for (const tab of tabs) {
    if (tab.id != null) {
      chrome.tabs.sendMessage(tab.id, { type: "gmic-set-active", active }).catch(() => {});
    }
  }
}

/**
 * Tra ve danh sach URL ung vien theo thu tu uu tien lon nhat -> nho nhat, de
 * crop.js thu lan luot va dung ban dau tien tai thanh cong. Anh Google Maps
 * thuong co dang ...=w222-h100-k-no hoac ...=s220 (tham so kich thuoc) —
 * =s0 thuong tra ve ban goc/lon nhat Google cho phep, nhung khong phai anh
 * nao cung chap nhan (nhat la anh nguoi dung tu dong gop, co the bi Google
 * gioi han) nen luon co cac muc du phong nho hon + link goc khong doi.
 */
function buildCandidateUrls(url) {
  if (!/googleusercontent\.com|ggpht\.com/i.test(url)) return [url];
  const sizeParamRegex = /=(?:s\d+|w\d+-h\d+)(-[a-z0-9-]+)?$/i;
  const base = sizeParamRegex.test(url) ? url.replace(sizeParamRegex, "") : url;
  const candidates = [`${base}=s0`, `${base}=s2400`, `${base}=s1600`, url];
  return [...new Set(candidates)];
}
