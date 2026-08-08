/**
 * Google Maps chan su kien 'contextmenu' (khong the dung menu chuot phai) va
 * nhieu anh trong Maps la <div> co background-image (lazy-load) thay vi the
 * <img> — click truc tiep vao "img" khong bat duoc nhung truong hop nay.
 * Giai phap: hien 1 nut noi (position:fixed) khi ren chuot qua ảnh, bam nut
 * do gui anh qua cua so Crop.
 *
 * QUAN TRONG (2 bai hoc tu thuc te):
 * 1) Capture-phase listener + xu ly nang (getComputedStyle/querySelector)
 *    CHAY DONG BO tren moi mouseover se lam Maps khong ve duoc anh lon trong
 *    khung xem chi tiet (rat co the do can tro timing luc Maps tu resize/ve
 *    canvas). -> tach phan xu ly nang ra requestAnimationFrame, listener
 *    goc chi luu toa do chuot roi thoat ngay.
 * 2) Doi sang bubble-phase de "an toan" thi lai KHONG bat duoc su kien nua —
 *    Maps goi stopPropagation() o cac phan tu anh nen bubble khong bao gio
 *    len toi document. -> phai dung capture-phase (an toan van dam bao nho
 *    diem (1)).
 * 3) Anh lon trong lightbox nam duoi 1 lop overlay (phan tu anh em, khong
 *    phai cha/con voi <img>/div-nen that) — leo cay DOM tu diem hover khong
 *    toi duoc. -> dung document.elementsFromPoint(x, y) de lay TOAN BO ngan
 *    xep phan tu tai dung toa do chuot (ke ca phan tu bi overlay che), quet
 *    ca ngan xep thay vi chi to tien cua 1 phan tu.
 *
 * Chi theo doi chuot khi cua so Crop dang mo (bat/tat qua message tu
 * background.js) — luc chi duyet Maps binh thuong thi khong dang ky
 * listener nao ca, khong ton chut tai nguyen nao.
 */
(function () {
  const IMG_SRC_PATTERN = /googleusercontent\.com|ggpht\.com/i;
  const MIN_SIZE = 64; // loc bot avatar nguoi danh gia (thuong nho hon)

  let btn = null;
  let currentUrl = null;
  let hideTimer = null;
  let rafPending = false;
  let lastX = 0;
  let lastY = 0;

  function bigEnough(el) {
    return el.offsetWidth >= MIN_SIZE && el.offsetHeight >= MIN_SIZE;
  }

  function extractUrlFromImg(imgEl) {
    const src = imgEl.currentSrc || imgEl.src || "";
    return IMG_SRC_PATTERN.test(src) ? src : null;
  }

  function extractUrlFromBackground(el) {
    const bg = getComputedStyle(el).backgroundImage;
    const m = /url\(["']?(.*?)["']?\)/.exec(bg || "");
    if (!m || !m[1]) return null;
    return IMG_SRC_PATTERN.test(m[1]) ? m[1] : null;
  }

  /** Quet toan bo ngan xep phan tu tai (x, y) — bat duoc ca anh bi overlay che. */
  function findImageUrlAtPoint(x, y) {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (!(el instanceof Element) || el === btn || !bigEnough(el)) continue;

      if (el.tagName === "IMG") {
        const url = extractUrlFromImg(el);
        if (url) return { url, target: el };
      }

      const bgUrl = extractUrlFromBackground(el);
      if (bgUrl) return { url: bgUrl, target: el };
    }

    // Du phong: phan tu tren cung co the la wrapper chua anh la con truc tiep
    // (thay vi chinh no la anh) — vd 1 lop trong suot bao quanh <img>.
    const top = stack[0];
    if (top instanceof Element) {
      const childImg = top.querySelector && top.querySelector("img[src]");
      if (childImg && bigEnough(childImg)) {
        const url = extractUrlFromImg(childImg);
        if (url) return { url, target: childImg };
      }
    }
    return null;
  }

  function ensureButton() {
    if (btn) return btn;
    btn = document.createElement("button");
    btn.id = "gmic-pick-btn";
    btn.type = "button";
    btn.textContent = "✂ Cắt ảnh này";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!currentUrl) return;
      chrome.runtime.sendMessage({ type: "gmic-image-clicked", src: currentUrl });
      btn.textContent = "Đã gửi ✓";
      setTimeout(() => {
        if (btn) btn.textContent = "✂ Cắt ảnh này";
      }, 900);
    });
    document.documentElement.appendChild(btn);
    return btn;
  }

  function positionButton(target) {
    const rect = target.getBoundingClientRect();
    const b = ensureButton();
    b.style.top = Math.max(4, rect.top + 6) + "px";
    b.style.left = Math.min(window.innerWidth - 120, Math.max(4, rect.right - 120)) + "px";
    b.style.display = "block";
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (btn) btn.style.display = "none";
      currentUrl = null;
    }, 250);
  }

  function processHover() {
    rafPending = false;
    const found = findImageUrlAtPoint(lastX, lastY);
    if (!found) {
      scheduleHide();
      return;
    }
    clearTimeout(hideTimer);
    currentUrl = found.url;
    positionButton(found.target);
  }

  function onMouseMove(e) {
    if (e.target === btn) return; // dang di chuyen tren chinh nut, giu nguyen trang thai
    lastX = e.clientX;
    lastY = e.clientY;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(processHover);
  }

  function onScroll() {
    if (btn && btn.style.display !== "none") btn.style.display = "none";
  }

  let trackingEnabled = false;

  function enableTracking() {
    if (trackingEnabled) return;
    trackingEnabled = true;
    document.addEventListener("mousemove", onMouseMove, true); // capture phase — xem giai thich o dau file
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function disableTracking() {
    if (!trackingEnabled) return;
    trackingEnabled = false;
    document.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("scroll", onScroll, { passive: true });
    clearTimeout(hideTimer);
    currentUrl = null;
    if (btn) btn.style.display = "none";
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "gmic-set-active") return;
    if (message.active) enableTracking();
    else disableTracking();
  });

  // Trang vua nap (F5 / mo tab moi) — hoi background xem cua so Crop co dang
  // mo san khong de biet co can bat theo doi chuot ngay hay khong.
  chrome.runtime.sendMessage({ type: "gmic-query-active" }, (response) => {
    if (chrome.runtime.lastError) return; // background chua san sang, bo qua
    if (response?.active) enableTracking();
  });
})();
