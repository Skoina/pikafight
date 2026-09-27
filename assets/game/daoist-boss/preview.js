(() => {
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');
  const count = document.getElementById('count');
  const toggle = document.getElementById('toggle');
  const replay = document.getElementById('replay');
  const duration = 10.2;
  const files = {
    idle: 'idle.png', cast1: 'cast-01.png', cast2: 'cast-02.png', cast3: 'cast-03.png',
    jump: 'jump-back.png', fireball: 'fireball.png', inner: 'lightning-inner-3.png',
    middle: 'lightning-middle-6.png', outer: 'lightning-outer-9.png',
    shield: 'shield.png', explosion: 'shield-explosion.png', hero: '../dog-walk.png'
  };
  const images = {};
  let elapsed = 0;
  let lastTime = 0;
  let playing = true;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`無法載入 ${src}`));
      img.src = src;
    });
  }

  function drawCentered(img, x, bottom, height, alpha = 1) {
    const width = height * img.width / img.height;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - width / 2, bottom - height, width, height);
    ctx.globalAlpha = 1;
  }

  function drawEffect(img, x, y, width, height, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - width / 2, y - height / 2, width, height);
    ctx.globalAlpha = 1;
  }

  function castingFrame(t, start) {
    const phase = t - start;
    if (phase < 0 || phase >= 0.72) return 'idle';
    if (phase < 0.24) return 'cast1';
    if (phase < 0.48) return 'cast2';
    return 'cast3';
  }

  function render(t) {
    const w = canvas.width, h = canvas.height;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#141c2c'); bg.addColorStop(1, '#283348');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8e96ae1c'; ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.fillStyle = '#0e1423a8';
    ctx.beginPath(); ctx.ellipse(510, 525, 480, 62, 0, 0, Math.PI * 2); ctx.fill();

    let bossX = 250, bossY = 530, frame = 'idle';
    let label = '準備施法';
    count.textContent = '';

    if (t < 2.35) {
      label = '第一式：火球 · 揮扇、直線發射、後跳';
      frame = castingFrame(t, 0);
      if (t >= 0.74 && t < 1.95) {
        const progress = (t - 0.74) / 1.21;
        drawEffect(images.fireball, 350 + progress * 770, 332, 160, 80);
      }
      if (t >= 0.86 && t < 1.62) {
        frame = 'jump';
        const p = (t - 0.86) / 0.76;
        bossX -= p * 82;
        bossY -= Math.sin(p * Math.PI) * 32;
      } else if (t >= 1.62) bossX = 168;
    } else if (t < 4.9) {
      label = '第二式：落雷 · 由內向外 3、6、9 道';
      frame = castingFrame(t, 2.35);
      if (t >= 3.07 && t < 3.62) drawEffect(images.inner, 530, 370, 300, 330);
      if (t >= 3.62 && t < 4.17) drawEffect(images.middle, 530, 370, 540, 390);
      if (t >= 4.17 && t < 4.72) drawEffect(images.outer, 530, 365, 820, 460);
    } else {
      label = '第三式：護罩 · 無敵三秒，向主角移動後爆炸';
      frame = castingFrame(t, 4.9);
      if (t >= 5.62 && t < 8.62) {
        const p = (t - 5.62) / 3;
        bossX = 250 + p * 330;
        count.textContent = String(3 - Math.floor((t - 5.62)));
      } else if (t >= 8.62) bossX = 580;
    }

    const hero = images.hero;
    ctx.drawImage(hero, 0, 0, hero.width / 4, hero.height / 2, 772, 374, 132, 176);
    drawCentered(images[frame], bossX, bossY, 390);

    if (t >= 5.62 && t < 8.62) drawEffect(images.shield, bossX, 332, 400, 435, 0.82);
    if (t >= 8.62 && t < 9.38) {
      const p = (t - 8.62) / 0.76;
      drawEffect(images.explosion, bossX, 345, 260 + 380 * p, 260 + 380 * p, 1 - p * 0.55);
      label = '第三式：護罩爆炸';
    }
    status.textContent = label;
  }

  function tick(now) {
    if (playing && lastTime) elapsed = (elapsed + Math.min((now - lastTime) / 1000, 0.1)) % duration;
    lastTime = now;
    if (images.idle) render(elapsed);
    requestAnimationFrame(tick);
  }

  toggle.addEventListener('click', () => {
    playing = !playing;
    toggle.textContent = playing ? '暫停' : '繼續';
  });
  replay.addEventListener('click', () => { elapsed = 0; playing = true; toggle.textContent = '暫停'; });

  Promise.all(Object.entries(files).map(async ([name, src]) => { images[name] = await loadImage(src); }))
    .then(() => { render(0); requestAnimationFrame(tick); })
    .catch(error => { status.textContent = error.message; });
})();
