(() => {
  const fullscreenButton = document.getElementById('fullscreen-toggle');
  const help = document.getElementById('display-help');
  const helpText = document.getElementById('display-help-text');
  const closeHelp = document.getElementById('display-help-close');
  const copyLink = document.getElementById('copy-game-link');
  const userAgent = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isInApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger/i.test(userAgent);
  const isStandalone = () => navigator.standalone === true ||
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches;
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const requestFullscreen = document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen;

  const viewport = document.getElementById('viewport');
  const shell = document.getElementById('game-shell');
  let pendingLayout = false;

  function fitViewport() {
    pendingLayout = false;
    const visible = window.visualViewport;
    const viewWidth = visible?.width || window.innerWidth;
    const viewHeight = visible?.height || window.innerHeight;
    viewport.style.width = viewWidth + 'px';
    viewport.style.height = viewHeight + 'px';
    viewport.style.left = (visible?.offsetLeft || 0) + 'px';
    viewport.style.top = (visible?.offsetTop || 0) + 'px';
    const padding = getComputedStyle(viewport);
    const left = parseFloat(padding.paddingLeft) || 0;
    const right = parseFloat(padding.paddingRight) || 0;
    const top = parseFloat(padding.paddingTop) || 0;
    const bottom = parseFloat(padding.paddingBottom) || 0;
    const availableWidth = Math.max(1, viewWidth - left - right);
    const availableHeight = Math.max(1, viewHeight - top - bottom);
    const landscape = availableWidth > availableHeight;
    // Keep a complete, stable composition while browser bars reduce the space.
    const compact = landscape ? availableHeight < 600 : availableWidth < 600;
    const width = compact ? (landscape ? 844 : 390) : availableWidth;
    const height = compact ? (landscape ? 420 : 720) : availableHeight;
    const scale = Math.min(availableWidth / width, availableHeight / height);
    shell.style.width = width + 'px';
    shell.style.height = height + 'px';
    shell.style.left = (left + (availableWidth - width * scale) / 2) + 'px';
    shell.style.top = (top + (availableHeight - height * scale) / 2) + 'px';
    shell.style.transform = `scale(${scale})`;
    shell.style.setProperty('--game-vw', width / 100 + 'px');
    shell.style.setProperty('--game-vh', height / 100 + 'px');
    const previous = window.GameViewport;
    window.GameViewport = { width, height, scale };
    if (!previous || previous.width !== width || previous.height !== height || previous.scale !== scale) {
      window.dispatchEvent(new Event('gameviewportchange'));
    }
  }

  function scheduleLayout() {
    if (pendingLayout) return;
    pendingLayout = true;
    requestAnimationFrame(fitViewport);
  }
  window.addEventListener('resize', scheduleLayout);
  window.addEventListener('orientationchange', scheduleLayout);
  window.addEventListener('pageshow', scheduleLayout);
  window.visualViewport?.addEventListener('resize', scheduleLayout);
  window.visualViewport?.addEventListener('scroll', scheduleLayout);
  fitViewport();

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
        catch { /* Fullscreen is optional; ordinary browser play works in either orientation. */ }
      }
    } catch {
      showHelp();
    }
  }

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
})();
