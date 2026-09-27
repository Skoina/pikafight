(() => {
  const startButton = document.getElementById('start-button');
  const fullscreenButton = document.getElementById('fullscreen-toggle');
  const advice = document.getElementById('display-advice-text');
  const help = document.getElementById('display-help');
  const helpText = document.getElementById('display-help-text');
  const closeHelp = document.getElementById('display-help-close');
  const copyLink = document.getElementById('copy-game-link');
  const rotateOverlay = document.getElementById('rotate-overlay');
  const rotateDismiss = document.getElementById('rotate-dismiss');
  const userAgent = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isInApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger/i.test(userAgent);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.maxTouchPoints > 1 && matchMedia('(max-width: 1100px)').matches);
  const isStandalone = () => navigator.standalone === true ||
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches;
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const requestFullscreen = document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen;

  if (isMobile) document.body.classList.add('mobile-device');
  if (isMobile && !isStandalone()) {
    if (isInApp) {
      advice.textContent = '請先轉橫向。IG、LINE 等內建瀏覽器可嘗試全螢幕；若工具列仍在，請用選單改由手機瀏覽器開啟。';
    } else if (isIOS) {
      advice.textContent = '請先轉橫向。iPhone 可從 Safari「分享 → 加入主畫面」，由桌面圖示開啟以隱藏網址列。';
    } else {
      advice.textContent = '請先轉橫向，按「全螢幕並進入遊戲」可嘗試隱藏瀏覽器工具列。';
    }
  } else if (isMobile) {
    advice.textContent = '請將手機轉橫向，享受完整遊戲畫面。';
  }
  if (isMobile && !isIOS && !isInApp && requestFullscreen && !isStandalone()) {
    startButton.textContent = '全螢幕並進入遊戲';
  }

  function helpMessage() {
    if (isStandalone()) return '你已從手機主畫面開啟遊戲。請將手機轉橫向；若畫面未旋轉，請關閉系統的直向鎖定。';
    if (isInApp && isIOS) return 'IG、LINE 等內建瀏覽器可能不允許網頁隱藏工具列。請用右上角選單選「在 Safari 開啟」，再於 Safari 點「分享 → 加入主畫面」，從主畫面圖示開啟遊戲。';
    if (isInApp) return 'IG、LINE 等內建瀏覽器可能不允許全螢幕。請用右上角選單選「在瀏覽器開啟」，再按遊戲右上角的 ⛶。';
    if (isIOS) return 'iPhone Safari 無法保證用網頁按鈕隱藏網址列。請在 Safari 點「分享 → 加入主畫面」，再從主畫面圖示開啟遊戲。';
    return '目前的瀏覽器未能進入全螢幕。請在手機瀏覽器開啟遊戲，再按右上角的 ⛶；也可以將網站加入主畫面。';
  }

  function showHelp() {
    helpText.textContent = helpMessage();
    help.hidden = false;
    closeHelp.focus();
  }

  async function enterFullscreen() {
    if (isStandalone()) {
      showHelp();
      return;
    }
    if (!requestFullscreen || document.fullscreenEnabled === false) {
      showHelp();
      return;
    }
    try {
      await requestFullscreen.call(document.documentElement);
      if (screen.orientation && screen.orientation.lock) {
        try { await screen.orientation.lock('landscape'); }
        catch { /* Orientation lock is optional; the rotation prompt remains available. */ }
      }
    } catch {
      showHelp();
    }
  }

  startButton.addEventListener('click', () => {
    if (isMobile && !isStandalone()) void enterFullscreen();
  });
  fullscreenButton.addEventListener('click', () => {
    if (fullscreenElement()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) void Promise.resolve(exit.call(document));
    } else {
      void enterFullscreen();
    }
  });

  function updateFullscreenButton() {
    const active = !!fullscreenElement();
    fullscreenButton.setAttribute('aria-label', active ? '離開全螢幕' : '全螢幕選項');
    fullscreenButton.title = active ? '離開全螢幕' : '全螢幕選項';
    fullscreenButton.setAttribute('aria-pressed', String(active));
  }
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
  updateFullscreenButton();

  closeHelp.addEventListener('click', () => { help.hidden = true; });
  copyLink.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      copyLink.textContent = '已複製連結';
    } catch {
      helpText.textContent += ' 複製失敗時，可從瀏覽器的分享選單複製連結。';
    }
  });
  rotateDismiss.addEventListener('click', () => rotateOverlay.classList.add('dismissed'));
  window.addEventListener('orientationchange', () => rotateOverlay.classList.remove('dismissed'));
})();
