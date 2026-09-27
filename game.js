(() => {
  const bootStart = performance.now();
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const stick = document.getElementById('joystick');
  const thumb = document.getElementById('thumb');
  const loading = document.getElementById('loading');
  const startScreen = document.getElementById('start-screen');
  const startButton = document.getElementById('start-button');
  const tip = document.getElementById('tip');
  const statsPanel = document.getElementById('hp');
  const locationTitle = document.getElementById('location');
  const actionButton = document.getElementById('action');
  const shopPanel = document.getElementById('shop');
  const shopTitle = document.getElementById('shop-title');
  const shopGold = document.getElementById('shop-gold');
  const shopList = document.getElementById('shop-list');
  const shopMessage = document.getElementById('shop-message');
  const storyPanel = document.getElementById('story');
  const storyName = document.getElementById('story-name');
  const storyText = document.getElementById('story-text');
  const storyProgress = document.getElementById('story-progress');
  const storyNext = document.getElementById('story-next');
  const storySkip = document.getElementById('story-skip');
  const storyLeft = document.getElementById('story-left');
  const storyRight = document.getElementById('story-right');
  const endingPanel = document.getElementById('ending');
  const keys = new Set();
  const joystick = { x: 0, y: 0, pointer: null };
  const demo = new URLSearchParams(location.search).get('demo');
  const combatPreview = demo === 'combat';
  const levelPreview = demo === 'levelup';
  const terrainDebug = new URLSearchParams(location.search).get('debug') === 'terrain';
  const freshPreview = new URLSearchParams(location.search).get('fresh') === '1';
  const townPreview = new URLSearchParams(location.search).get('map') === 'town';
  const riverPreview = new URLSearchParams(location.search).get('map') === 'river';
  const altarPreview = new URLSearchParams(location.search).get('map') === 'altar';
  const storyEnabled = !demo && !townPreview && !riverPreview && !altarPreview;
  let hasEnteredGame = !storyEnabled;
  let startRequested = false;
  if (hasEnteredGame) startScreen.hidden = true;
  const start = combatPreview ? { x: 960, y: 450 } :
    demo === 'range' ? { x: 820, y: 450 } : { x: 794, y: 445 };
  const saved = (() => {
    if (freshPreview) return {};
    try { return JSON.parse(localStorage.getItem('wuxia-dog-profile-v1') || '{}'); }
    catch { return {}; }
  })();
  const storedExperience = Number.isFinite(saved.experience) ? saved.experience : 0;
  const initialExperience = levelPreview ? Progression.levelThresholds[1] :
    saved.balanceVersion === 2
      ? Math.max(0, Math.min(Progression.levelThresholds[Progression.maxLevel - 1], storedExperience))
      : Progression.migrateExperience(storedExperience);
  const initialLevel = Progression.levelForExperience(initialExperience);
  const initialStats = Progression.statsForLevel(initialLevel);
  let inventory = Shops.cleanInventory(saved.inventory);
  if (freshPreview) {
    const requestedWeapon = new URLSearchParams(location.search).get('weapon');
    const requestedArmor = new URLSearchParams(location.search).get('armor');
    const weapon = Shops.items[requestedWeapon]?.merchant === 'weapon' ? requestedWeapon : null;
    const armor = Shops.items[requestedArmor]?.merchant === 'armor' ? requestedArmor : null;
    if (weapon || armor) inventory = Shops.cleanInventory({ owned: [weapon, armor].filter(Boolean), weapon, armor });
  }
  const initialBonus = Shops.bonuses(inventory);
  let currentMap = storyEnabled || townPreview ? 'town' : riverPreview ? 'river' : altarPreview ? 'altar' : 'forest';
  const music = MapMusic.create();
  music.select(currentMap);
  const musicToggle = document.getElementById('music-toggle');
  function updateMusicToggle() {
    const muted = music.isMuted();
    musicToggle.textContent = muted ? '🔇' : '♫';
    musicToggle.setAttribute('aria-label', muted ? '開啟音樂' : '關閉音樂');
    musicToggle.setAttribute('aria-pressed', String(muted));
    musicToggle.title = muted ? '開啟音樂' : '關閉音樂';
  }
  let activeShop = null;
  let nearbyAction = null;
  let storyState = null;
  let storyTimer = null;
  let endingTimer = null;
  let endingShown = false;
  let introSeen = !!saved.introSeen;
  let seenClues = Array.isArray(saved.seenClues) ? saved.seenClues.filter(id => Story.clueIds.includes(id)) : [];
  const player = {
    x: storyEnabled || townPreview ? 220 : riverPreview ? 1100 : altarPreview ? 620 : start.x,
    y: storyEnabled || townPreview ? 460 : riverPreview ? 390 : altarPreview ? 550 : start.y, facing: 0, step: 0,
    level: initialLevel, experience: initialExperience,
    gold: Number.isFinite(saved.gold) ? Math.max(0, Math.floor(saved.gold)) : 0,
    hp: Number.isFinite(saved.hp) ? Math.max(1, Math.min(initialStats.maxHp, Math.floor(saved.hp))) : initialStats.maxHp,
    ...initialStats,
    attack: initialStats.attack + initialBonus.attack,
    defense: initialStats.defense + initialBonus.defense
  };
  const newAttack = () => ({ active: false, elapsed: 0, cooldown: 0, hit: false });
  function makeEnemy(position, stats, id) {
    return { ...position, id, facing: 2, step: 0, moving: false,
      hp: stats.maxHp, maxHp: stats.maxHp, respawn: 0, hurt: 0,
      attack: stats.attack, defense: stats.defense, attackSpeed: stats.attackSpeed,
      action: newAttack() };
  }
  const forestCats = [];
  for (let index = 0; index < 2; index++) {
    const position = (combatPreview || demo === 'range') && index === 0
      ? { x: 1058, y: 450 }
      : ForestSpawns.pick(Terrain, player, forestCats);
    forestCats.push(makeEnemy(position, Progression.cat, index + 1));
  }
  const cat = forestCats[0];
  const eliteSpawns = [
    { x: 392, y: 402 }, { x: 620, y: 334 }, { x: 868, y: 388 },
    { x: 535, y: 574 }, { x: 1010, y: 566 }
  ];
  const eliteCats = eliteSpawns.map((position, index) => ({ ...makeEnemy(position, Progression.eliteCat, index + 1),
    facing: index % 2 ? 2 : 3 }));
  const daoist = DaoistBoss.create();
  let eliteRespawnAt = null;
  const camera = { x: player.x, y: player.y - (altarPreview ? 90 : 0) };
  const battle = {
    dog: { active: false, elapsed: 0, cooldown: 0, hit: false },
    dogHurt: 0, blocked: 0,
    levelUp: levelPreview ? 1.5 : 0, levelReached: levelPreview ? 2 : 1,
    movedDuringAttack: false,
    effectsCreated: 0,
    effects: [], floaters: [], loot: []
  };
  const seenPhases = new Set(['idle']);
  const seenWalkFrames = new Set();
  const seenLevelFrames = new Set();
  const seenEliteAttackFrames = new Set();
  const images = {};
  const outfitCache = new Map();
  let maxLevelFlameLoad = null;
  let shopBusy = false;
  const assetPaths = {
    map: 'assets/previews/jungle-map-v1.png',
    townMap: 'assets/game/town-map.png',
    riverMap: 'assets/game/river-platform-map.png',
    altarMap: 'assets/game/forbidden-heavenly-altar.png',
    merchants: 'assets/game/town-merchants.png',
    townItems: 'assets/game/town-items.png',
    swordArts: 'assets/game/sword-arts-v1.png',
    imperialFlame1: 'assets/game/imperial-flame-1.png',
    imperialFlame2: 'assets/game/imperial-flame-2.png',
    imperialFlame3: 'assets/game/imperial-flame-3.png',
    idle: 'assets/previews/dog-swordsman-v2.png',
    walk: 'assets/game/dog-walk.png',
    dogCombat: 'assets/game/dog-combat.png',
    cat: 'assets/game/ranger-cat.png',
    catWalk: 'assets/game/ranger-cat-walk.png',
    eliteCat: 'assets/game/elite-ranger-cat.png',
    eliteWindup: 'assets/game/elite-ranger-cat-attack-windup.png',
    eliteSlash: 'assets/game/elite-ranger-cat-attack-slash.png',
    coins: 'assets/game/coins.png',
    level1: 'assets/game/level-up-1.png',
    level2: 'assets/game/level-up-2.png',
    level3: 'assets/game/level-up-3.png',
    slash: 'assets/game/slash-effect.png',
    daoistIdle: 'assets/game/daoist-boss/idle.png',
    daoistCast1: 'assets/game/daoist-boss/cast-01.png',
    daoistCast2: 'assets/game/daoist-boss/cast-02.png',
    daoistCast3: 'assets/game/daoist-boss/cast-03.png',
    daoistHop: 'assets/game/daoist-boss/jump-back.png',
    daoistFireball: 'assets/game/daoist-boss/fireball.png',
    daoistLightning1: 'assets/game/daoist-boss/lightning-inner-3.png',
    daoistLightning2: 'assets/game/daoist-boss/lightning-middle-6.png',
    daoistLightning3: 'assets/game/daoist-boss/lightning-outer-9.png',
    daoistShield: 'assets/game/daoist-boss/shield.png',
    daoistExplosion: 'assets/game/daoist-boss/shield-explosion.png'
  };
  let ready = false;
  let width = 0, height = 0, dpr = 1, scale = 1, lastTime = 0;
  let fpsWindow = 0, fpsFrames = 0;
  let drawTotal = 0, drawSamples = 0;
  let currentTip = '';

  function enterGame() {
    if (!ready) {
      startRequested = true;
      startButton.disabled = true;
      startButton.textContent = '載入中…';
      return;
    }
    if (hasEnteredGame) return;
    hasEnteredGame = true;
    keys.clear();
    startScreen.hidden = true;
    if (!introSeen) beginStory('intro');
  }

  startButton.addEventListener('click', enterGame);

  function terrain() {
    return currentMap === 'town' ? TownTerrain : currentMap === 'river' ? RiverTerrain :
      currentMap === 'altar' ? AltarTerrain : Terrain;
  }

  function loadOutfit(nextInventory) {
    if (!nextInventory.armor && !nextInventory.weapon) return Promise.resolve(null);
    const key = (nextInventory.armor || 'none') + '-' + (nextInventory.weapon || 'none');
    if (!SpriteLayouts[key] || !AttackLayouts[key])
      return Promise.reject(new Error('Missing outfit layout: ' + key));
    if (outfitCache.has(key)) {
      const cached = outfitCache.get(key);
      outfitCache.delete(key);
      outfitCache.set(key, cached);
      return cached;
    }
    if (outfitCache.size >= 4) outfitCache.delete(outfitCache.keys().next().value);
    const walk = new Image();
    const attack = new Image();
    walk.src = 'assets/game/dog-walk-outfits/' + key + '.png';
    attack.src = 'assets/game/dog-attack-outfits/' + key + '.png';
    outfitCache.set(key, Promise.all([walk.decode(), attack.decode()]).then(() => ({ walk, attack })).catch(error => {
      outfitCache.delete(key);
      throw error;
    }));
    return outfitCache.get(key);
  }

  function loadMaxLevelFlames() {
    if (images.maxLevelFlames) return Promise.resolve(images.maxLevelFlames);
    if (maxLevelFlameLoad) return maxLevelFlameLoad;
    const frames = Array.from({ length: 5 }, (_, index) => {
      const image = new Image();
      image.src = 'assets/game/level10-blue-fire-' + (index + 1) + '.png';
      return image;
    });
    maxLevelFlameLoad = Promise.all(frames.map(image => image.decode())).then(() => {
      images.maxLevelFlames = frames;
      return frames;
    }).catch(error => { maxLevelFlameLoad = null; throw error; });
    return maxLevelFlameLoad;
  }

  function applyEquipmentStats() {
    const base = Progression.statsForLevel(player.level);
    const bonus = Shops.bonuses(inventory);
    player.maxHp = base.maxHp;
    player.attack = base.attack + bonus.attack;
    player.defense = base.defense + bonus.defense;
  }

  function healFromPotions() {
    const result = Shops.autoHeal(player.hp, player.maxHp, inventory);
    if (result.healed > 0) {
      player.hp = result.hp;
      floater('+' + result.healed + ' 體力', player.x, player.y - 105, '#b9f6bd', 16);
      updateHud();
      persistProfile();
    }
  }

  function restoreEliteWave() {
    eliteRespawnAt = null;
    eliteCats.forEach((enemy, index) => {
      enemy.x = eliteSpawns[index].x; enemy.y = eliteSpawns[index].y;
      enemy.hp = enemy.maxHp; enemy.respawn = 0; enemy.hurt = 0;
      enemy.facing = index % 2 ? 2 : 3; enemy.step = 0; enemy.moving = false;
      enemy.action = newAttack();
    });
  }

  function setMap(name, x, y) {
    clearTimeout(endingTimer);
    endingTimer = null;
    endingShown = false;
    endingPanel.classList.remove('visible');
    endingPanel.setAttribute('aria-hidden', 'true');
    currentMap = name;
    music.select(name);
    player.x = x; player.y = y; player.step = 0;
    camera.x = x; camera.y = y - (name === 'altar' ? 90 : 0);
    battle.dog.active = false;
    battle.effects.length = 0; battle.floaters.length = 0;
    for (const enemy of [...forestCats, ...eliteCats]) {
      enemy.action = newAttack(); enemy.moving = false;
    }
    if (name === 'altar') Object.assign(daoist, DaoistBoss.create());
    closeShop();
    const title = name === 'town' ? '汴河古鎮' : name === 'river' ? '河心石臺' :
      name === 'altar' ? '禁忌天壇' : '竹影迷林';
    locationTitle.textContent = title;
    canvas.setAttribute('aria-label', title + '探索地圖');
  }

  function nearestAction() {
    if (currentMap === 'forest') {
      if (Math.hypot(player.x - 1430, player.y - 280) < 82)
        return { kind: 'portal', destination: 'altar', label: '前往禁忌天壇' };
      if (Math.hypot(player.x - 878, player.y - 160) < 74)
        return { kind: 'portal', destination: 'town', label: '前往汴河古鎮' };
      if (Math.hypot(player.x - 1201, player.y - 758) < 78)
        return { kind: 'portal', destination: 'river', label: '下石階前往河心石臺' };
      return null;
    }
    if (currentMap === 'river') return Math.hypot(player.x - 1094, player.y - 268) < 80
      ? { kind: 'portal', destination: 'forest', label: '上石階返回竹影迷林' } : null;
    if (currentMap === 'altar') return Math.hypot(player.x - 620, player.y - 785) < 85
      ? { kind: 'portal', destination: 'forest', label: '返回竹影迷林' } : null;
    if ((!storyEnabled || Story.complete(seenClues)) && Math.hypot(player.x - 1420, player.y - 445) < 110)
      return { kind: 'portal', destination: 'forest', label: '前往竹影迷林' };
    for (const [id, merchant] of Object.entries(Shops.merchants)) {
      if (Math.hypot(player.x - merchant.x, player.y - merchant.y) < 110)
        return { kind: 'shop', merchant: id, label: '與' + merchant.name.split('・')[0] +
          (storyEnabled && !seenClues.includes(id) ? '交談' : '交易') };
    }
    return null;
  }

  function renderShop(message = '') {
    if (!activeShop) return;
    shopTitle.textContent = Shops.merchants[activeShop].name;
    shopGold.textContent = '持有金幣：' + player.gold + '　紅色藥水：' + inventory.potions;
    shopMessage.textContent = message;
    shopList.innerHTML = '';
    for (const [id, item] of Object.entries(Shops.items)) {
      if (item.merchant !== activeShop) continue;
      const row = document.createElement('div'); row.className = 'shop-item';
      const icon = document.createElement('div'); icon.className = 'shop-icon';
      icon.style.backgroundPosition = `${(item.icon % 4) * 100 / 3}% ${Math.floor(item.icon / 4) * 100}%`;
      const info = document.createElement('div'); info.className = 'shop-info';
      const name = document.createElement('strong'); name.textContent = item.name;
      const detail = document.createElement('small');
      detail.textContent = item.price + ' 元　' + (item.attack ? '攻擊力 +' + item.attack : item.defense ? '防禦力 +' + item.defense : '自動回復 10 體力') +
        (id === 'imperial' ? '　範圍內所有敵人受傷' : '');
      info.append(name, detail);
      const button = document.createElement('button'); button.className = 'shop-buy'; button.type = 'button';
      button.textContent = inventory[item.merchant] === id ? '已裝備' : inventory.owned.includes(id) ? '裝備' : '購買';
      button.disabled = inventory[item.merchant] === id;
      button.addEventListener('click', async () => {
        if (shopBusy) return;
        const result = Shops.buy(id, player.gold, inventory);
        if (!result.ok) { renderShop(result.reason); return; }
        if (item.merchant !== 'potion') {
          shopBusy = true;
          button.disabled = true;
          shopMessage.textContent = '更換俠客服裝中…';
          try {
            const outfit = await loadOutfit(result.inventory);
            images.outfit = outfit.walk;
            images.outfitAttack = outfit.attack;
          }
          catch {
            shopBusy = false;
            renderShop('角色素材載入失敗，請再試一次');
            return;
          }
          shopBusy = false;
        }
        player.gold = result.gold; inventory = result.inventory;
        applyEquipmentStats(); healFromPotions(); updateHud(); persistProfile();
        renderShop(result.equipped ? '已裝備 ' + item.name : '取得 ' + item.name);
      });
      row.append(icon, info, button); shopList.append(row);
    }
  }

  function closeShop() { activeShop = null; shopPanel.classList.remove('open'); }
  document.getElementById('shop-close').addEventListener('click', closeShop);
  function drawStoryPortrait(canvasId, image, columns, cell) {
    const portrait = document.getElementById(canvasId);
    const painter = portrait.getContext('2d');
    const cellWidth = image.width / columns;
    const ratio = Math.min(portrait.width / cellWidth, portrait.height / image.height);
    const drawWidth = cellWidth * ratio;
    const drawHeight = image.height * ratio;
    painter.clearRect(0, 0, portrait.width, portrait.height);
    painter.drawImage(image, cell * cellWidth, 0, cellWidth, image.height,
      (portrait.width - drawWidth) / 2, portrait.height - drawHeight, drawWidth, drawHeight);
  }

  function renderStory() {
    if (!storyState) return;
    clearTimeout(storyTimer);
    const line = storyState.lines[storyState.index];
    storyName.textContent = line.speaker;
    storyText.textContent = line.text;
    storyProgress.textContent = (storyState.index + 1) + ' / ' + storyState.lines.length;
    storyNext.textContent = storyState.index === storyState.lines.length - 1
      ? storyState.kind === 'outro' ? '開始探險' : '完成' : '繼續';
    storySkip.hidden = storyState.kind !== 'intro';
    storyLeft.classList.toggle('active', line.speaker === '小狗俠客');
    storyRight.classList.toggle('active', line.speaker !== '小狗俠客');
    if (storyState.kind === 'intro') storyTimer = setTimeout(nextStory, 3400);
  }

  function beginStory(kind, merchant = 'weapon') {
    closeShop();
    keys.clear(); releaseStick();
    storyState = { kind, merchant, index: 0,
      lines: kind === 'intro' ? Story.intro : kind === 'outro' ? Story.outro : Story.clues[merchant] };
    drawStoryPortrait('story-dog', images.idle, 4, 0);
    drawStoryPortrait('story-merchant', images.merchants, 3, Shops.merchants[merchant].sprite);
    storyPanel.classList.add('open');
    renderStory();
    storyNext.focus();
  }

  function finishStory() {
    clearTimeout(storyTimer);
    const { kind, merchant } = storyState;
    storyState = null;
    storyPanel.classList.remove('open');
    const newlyLearned = kind === 'clue' && !seenClues.includes(merchant);
    if (kind === 'intro') introSeen = true;
    if (newlyLearned) seenClues.push(merchant);
    persistProfile();
    if (newlyLearned && Story.complete(seenClues)) beginStory('outro', merchant);
    else if (kind === 'outro') tip.innerHTML = '線索已齊！<br>從村莊右邊前往竹影迷林';
  }

  function nextStory() {
    if (!storyState) return;
    clearTimeout(storyTimer);
    if (++storyState.index < storyState.lines.length) renderStory();
    else finishStory();
  }

  storyNext.addEventListener('click', nextStory);
  storySkip.addEventListener('click', () => {
    if (storyState?.kind === 'intro') finishStory();
  });
  document.getElementById('shop-story').addEventListener('click', () => {
    if (activeShop) beginStory('clue', activeShop);
  });
  actionButton.addEventListener('click', () => {
    if (!nearbyAction || storyState) return;
    if (nearbyAction.kind === 'portal') {
      if (nearbyAction.destination === 'town') setMap('town', 1300, 450);
      else if (nearbyAction.destination === 'river') setMap('river', 1100, 390);
      else if (nearbyAction.destination === 'altar') setMap('altar', 620, 550);
      else if (currentMap === 'river') setMap('forest', 1201, 724);
      else if (currentMap === 'altar') setMap('forest', 1390, 335);
      else setMap('forest', 878, 160);
    } else if (storyEnabled && !seenClues.includes(nearbyAction.merchant)) {
      beginStory('clue', nearbyAction.merchant);
    } else {
      activeShop = nearbyAction.merchant;
      shopPanel.classList.add('open');
      renderShop();
    }
  });

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, width < 500 ? 1.5 : 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    scale = terrainDebug
      ? Math.min(width / Terrain.width, height / Terrain.height)
      : width > height && height <= 500 && width <= 1000
        ? Math.max(.9, Math.min(1.05, height / 420))
        : Math.max(1.16, Math.min(1.5, width / 650));
  }

  function moveStick(event) {
    const box = stick.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const radius = box.width * .32;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const distance = Math.hypot(dx, dy);
    const amount = Math.min(distance, radius);
    const angle = Math.atan2(dy, dx);
    const px = Math.cos(angle) * amount;
    const py = Math.sin(angle) * amount;
    joystick.x = px / radius;
    joystick.y = py / radius;
    thumb.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
  }

  function releaseStick(event) {
    if (event && joystick.pointer !== event.pointerId) return;
    joystick.pointer = null;
    joystick.x = 0;
    joystick.y = 0;
    thumb.style.transform = 'translate(-50%, -50%)';
  }

  stick.addEventListener('pointerdown', event => {
    event.preventDefault();
    joystick.pointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    moveStick(event);
  });
  stick.addEventListener('pointermove', event => {
    if (joystick.pointer === event.pointerId) moveStick(event);
  });
  stick.addEventListener('pointerup', releaseStick);
  stick.addEventListener('pointercancel', releaseStick);
  stick.addEventListener('lostpointercapture', releaseStick);

  window.addEventListener('pointerdown', () => music.unlock(), { capture: true });
  window.addEventListener('keydown', () => music.unlock(), { capture: true });
  document.addEventListener('visibilitychange', () => music.setSuspended(document.hidden));
  window.addEventListener('pagehide', () => music.setSuspended(true));
  window.addEventListener('pageshow', () => music.setSuspended(document.hidden));
  musicToggle.addEventListener('click', () => {
    music.setMuted(!music.isMuted());
    updateMusicToggle();
  });

  const controls = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd']);
  window.addEventListener('keydown', event => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (storyState) {
      if (key === 'Enter' || key === ' ') { event.preventDefault(); nextStory(); }
      return;
    }
    if (controls.has(key)) { event.preventDefault(); keys.add(key); }
  });
  window.addEventListener('keyup', event => {
    keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  });
  window.addEventListener('blur', () => { keys.clear(); releaseStick(); });
  window.addEventListener('resize', resize);
  document.getElementById('reset').addEventListener('click', () => {
    if (storyState) return;
    const resetX = storyEnabled ? 220 : start.x;
    const resetY = storyEnabled ? 460 : start.y;
    setMap(storyEnabled ? 'town' : 'forest', resetX, resetY);
    player.x = resetX; player.y = resetY; player.facing = 0;
    player.hp = player.maxHp;
    for (const enemy of forestCats) {
      const others = forestCats.filter(other => other !== enemy);
      const position = ForestSpawns.pick(Terrain, player, others);
      enemy.x = position.x; enemy.y = position.y;
      enemy.hp = enemy.maxHp; enemy.respawn = 0; enemy.hurt = 0;
      enemy.facing = 2; enemy.step = 0; enemy.moving = false; enemy.action = newAttack();
    }
    restoreEliteWave();
    camera.x = resetX; camera.y = resetY;
    battle.dog = { active: false, elapsed: 0, cooldown: 0, hit: false };
    battle.dogHurt = 0; battle.blocked = 0;
    updateHud();
    persistProfile();
  });
  document.getElementById('ending-restart').addEventListener('click', () => {
    try { localStorage.removeItem('wuxia-dog-profile-v1'); }
    catch { /* Private browsing can disable storage. */ }
    location.replace(new URL('index.html', location.href).href);
  });

  function persistProfile() {
    if (freshPreview) return;
    try {
      localStorage.setItem('wuxia-dog-profile-v1', JSON.stringify({
        balanceVersion: 2, experience: player.experience, gold: player.gold, hp: player.hp, inventory,
        introSeen, seenClues
      }));
    } catch { /* Private browsing can disable storage. */ }
  }

  function updateHud() {
    const next = Progression.nextThreshold(player.level);
    const previous = Progression.levelThresholds[player.level - 1];
    const progress = next === null ? 100 : (player.experience - previous) / (next - previous) * 100;
    statsPanel.innerHTML =
      '<div class="stats-row"><strong>Lv.' + player.level + '</strong>' +
      '<span class="gold"><img src="assets/game/coins.png" alt=""> ' + player.gold + '</span></div>' +
      '<div class="stats-caption">體力 ' + player.hp + ' / ' + player.maxHp + '</div>' +
      '<div class="meter hp-meter"><i style="width:' + Math.round(player.hp / player.maxHp * 100) + '%"></i></div>' +
      '<div class="stats-caption">攻擊 ' + player.attack + '　防禦 ' + player.defense + '</div>' +
      '<div class="stats-caption">藥水 ' + inventory.potions + ' 瓶</div>' +
      '<div class="stats-caption">經驗 ' + player.experience + ' / ' + (next === null ? 'MAX' : next) + '</div>' +
      '<div class="meter xp-meter"><i style="width:' + Math.round(progress) + '%"></i></div>';
  }

  function floater(text, x, y, color, size = 19) {
    battle.floaters.push({ text, x, y, color, size, age: 0, duration: 1.15 });
  }

  function onEnemyDeath(enemy) {
    enemy.hp = 0;
    enemy.respawn = currentMap === 'forest' ? 5.5 : 0;
    enemy.action.active = false;
    enemy.hurt = 0;
    const elite = currentMap === 'river';
    const reward = elite ? Progression.eliteCat : Progression.cat;
    const gold = Progression.goldDrop(reward);
    if (elite) {
      battle.loot.push(...Loot.eliteDrops(enemy.x, enemy.y, gold));
      eliteRespawnAt = EliteWave.scheduleIfCleared(eliteCats, performance.now());
    } else {
      const pile = battle.loot.find(item => !item.collected && item.map === 'forest' &&
        item.kind === 'gold' && item.x === enemy.x + 45 && item.y === enemy.y + 24);
      if (pile) pile.amount += gold;
      else battle.loot.push({ map: 'forest', kind: 'gold',
        x: enemy.x + 45, y: enemy.y + 24, amount: gold, age: 0 });
    }
    floater('+' + reward.experience + ' 經驗', player.x, player.y - 115, '#fff0a8', 16);
    const result = Progression.grantExperience(player.experience, reward.experience);
    player.experience = result.experience;
    if (result.levelsGained > 0) {
      player.level = result.level;
      applyEquipmentStats();
      player.hp = Math.min(player.maxHp, player.hp + 10 * result.levelsGained);
      battle.levelUp = 1.5;
      battle.levelReached = player.level;
      seenPhases.add('levelUp');
      if (player.level === Progression.maxLevel) loadMaxLevelFlames().catch(() => {});
    }
    updateHud();
    persistProfile();
  }

  function onDogDefeat() {
    setMap('forest', start.x, start.y);
    for (const enemy of forestCats) {
      const others = forestCats.filter(other => other !== enemy);
      const position = ForestSpawns.pick(Terrain, player, others);
      enemy.x = position.x; enemy.y = position.y;
      enemy.hp = enemy.maxHp; enemy.respawn = 0; enemy.hurt = 0;
      enemy.facing = 2; enemy.moving = false; enemy.step = 0; enemy.action = newAttack();
    }
    restoreEliteWave();
    player.hp = player.maxHp;
    battle.dog.active = false;
    floater('重新振作', player.x, player.y - 115, '#fff0d2', 17);
    updateHud();
    persistProfile();
  }

  function beginEnding() {
    if (endingTimer || endingShown) return;
    endingTimer = setTimeout(() => {
      endingTimer = null;
      endingShown = true;
      endingPanel.classList.add('visible');
      endingPanel.setAttribute('aria-hidden', 'false');
      endingPanel.focus();
      music.select('town');
    }, 1200);
  }

  function updateAltarBattle(dt) {
    const swordRange = CombatTargets.rangeForWeapon(inventory.weapon);
    const distance = Math.hypot(player.x - daoist.x, player.y - daoist.y);
    if (!daoist.defeated && distance <= swordRange - 18 &&
        !battle.dog.active && battle.dog.cooldown === 0) {
      battle.dog = { active: true, elapsed: 0, cooldown: 0, hit: false };
      seenPhases.add('dogWindup');
    }
    if (battle.dog.active) {
      battle.dog.elapsed += dt;
      if (!battle.dog.hit && battle.dog.elapsed >= .2) {
        battle.dog.hit = true;
        battle.effects.push({ owner: 'dog', age: 0, duration: inventory.weapon ? .57 : .36,
          weapon: inventory.weapon, x: player.x, y: player.y,
          direction: daoist.x < player.x ? -1 : 1 });
        battle.effectsCreated++;
        seenPhases.add('dogSlash');
        if (!daoist.defeated && Math.hypot(player.x - daoist.x, player.y - daoist.y) <= swordRange) {
          const damage = Progression.rolledDamage(player.attack, daoist.defense);
          const dealt = DaoistBoss.hit(daoist, damage);
          floater(dealt ? '-' + dealt : '無敵', daoist.x, daoist.y - 170,
            dealt ? '#ffd379' : '#8cdbff');
          if (daoist.defeated) {
            floater('黑犬道士敗北', daoist.x, daoist.y - 198, '#fff2bb', 21);
            beginEnding();
          }
        }
      }
      if (battle.dog.elapsed >= (inventory.weapon ? .62 : .48)) {
        battle.dog.active = false;
        battle.dog.cooldown = .34;
      }
    }
    for (const hit of DaoistBoss.update(daoist, player, dt, AltarTerrain)) {
      const amount = Progression.rolledDamage(hit.damage, player.defense);
      player.hp = Math.max(0, player.hp - amount);
      healFromPotions();
      battle.dogHurt = .34;
      floater('-' + amount, player.x, player.y - 115, '#ff9f8a');
      updateHud();
      persistProfile();
      if (player.hp === 0) { onDogDefeat(); break; }
    }
    battle.effects = battle.effects.filter(effect => (effect.age += dt) < effect.duration);
    battle.floaters = battle.floaters.filter(item => (item.age += dt) < item.duration);
  }

  function updateBattle(dt) {
    battle.dog.cooldown = Math.max(0, battle.dog.cooldown - dt);
    battle.dogHurt = Math.max(0, battle.dogHurt - dt);
    battle.levelUp = Math.max(0, battle.levelUp - dt);
    if (EliteWave.ready(eliteRespawnAt, performance.now())) restoreEliteWave();
    if (currentMap === 'town') {
      battle.effects = battle.effects.filter(effect => (effect.age += dt) < effect.duration);
      battle.floaters = battle.floaters.filter(item => (item.age += dt) < item.duration);
      return;
    }
    if (currentMap === 'altar') { updateAltarBattle(dt); return; }
    if (levelPreview && battle.levelUp === 0) battle.levelUp = 1.5;
    const enemies = currentMap === 'forest' ? forestCats : eliteCats;
    const ground = terrain();
    const visibleW = width / scale, visibleH = height / scale;
    const offset = width < 500 ? 48 / scale : 0;
    const viewX = clamp(camera.x - offset, visibleW / 2, ground.width - visibleW / 2);
    const viewY = clamp(camera.y, visibleH / 2, ground.height - visibleH / 2);
    const swordRange = CombatTargets.rangeForWeapon(inventory.weapon);
    for (const enemy of enemies) {
      const action = enemy.action;
      action.cooldown = Math.max(0, action.cooldown - dt);
      enemy.hurt = Math.max(0, enemy.hurt - dt);
      enemy.moving = false;
      if (enemy.hp === 0 && enemy.respawn > 0) {
        enemy.respawn -= dt;
        if (enemy.respawn <= 0) {
          const position = ForestSpawns.pick(Terrain, player, forestCats.filter(other => other !== enemy));
          enemy.x = position.x; enemy.y = position.y;
          enemy.hp = enemy.maxHp; enemy.respawn = 0; enemy.facing = 2; enemy.step = 0;
        }
      }
      if (enemy.hp <= 0) continue;
      if (!action.active && enemy.hurt === 0 &&
          Chase.inView(enemy.x, enemy.y, viewX, viewY, visibleW, visibleH)) {
        const toward = { x: player.x - enemy.x, y: player.y - enemy.y };
        const next = Chase.advance(enemy, player, dt, ground);
        enemy.x = next.x; enemy.y = next.y; enemy.moving = next.moved;
        if (next.moved) {
          enemy.facing = Math.abs(toward.x) > Math.abs(toward.y)
            ? (toward.x < 0 ? 2 : 3) : (toward.y < 0 ? 1 : 0);
          enemy.step += dt * 4.9;
        }
      }
      const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (distance <= 132 && !action.active && action.cooldown === 0) {
        enemy.action = { active: true, elapsed: 0, cooldown: 0, hit: false };
        seenPhases.add('catWindup');
      }
    }
    const nearest = enemies.filter(enemy => enemy.hp > 0)
      .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) -
        Math.hypot(player.x - b.x, player.y - b.y))[0];
    if (nearest && Math.hypot(player.x - nearest.x, player.y - nearest.y) <= swordRange - 18 &&
        !battle.dog.active && battle.dog.cooldown === 0) {
      battle.dog = { active: true, elapsed: 0, cooldown: 0, hit: false };
      seenPhases.add('dogWindup');
    }
    if (battle.dog.active) {
      battle.dog.elapsed += dt;
      if (!battle.dog.hit && battle.dog.elapsed >= .2) {
        battle.dog.hit = true;
        battle.effects.push({ owner: 'dog', age: 0, duration: inventory.weapon ? .57 : .36,
          weapon: inventory.weapon, x: player.x, y: player.y,
          direction: nearest && nearest.x < player.x ? -1 : 1 });
        battle.effectsCreated++;
        seenPhases.add('dogSlash');
        for (const enemy of CombatTargets.targetsForStrike(enemies, player, inventory.weapon)) {
          const amount = Progression.rolledDamage(player.attack, enemy.defense ?? 0);
          enemy.hp = Math.max(0, enemy.hp - amount);
          enemy.hurt = .36;
          floater('-' + amount, enemy.x, enemy.y - 105, '#ffd379');
          seenPhases.add('catHit');
          if (enemy.hp === 0) onEnemyDeath(enemy);
        }
      }
      if (battle.dog.elapsed >= (inventory.weapon ? .62 : .48)) {
        battle.dog.active = false;
        battle.dog.cooldown = .34;
      }
    }

    for (const enemy of enemies) {
      const action = enemy.action;
      if (!action.active || enemy.hp <= 0) continue;
      const timing = Progression.attackTiming(enemy);
      action.elapsed += dt;
      if (!action.hit && action.elapsed >= timing.windup) {
        action.hit = true;
        battle.effects.push({ owner: 'cat', age: 0, duration: timing.windup,
          x: enemy.x, y: enemy.y, direction: player.x < enemy.x ? -1 : 1 });
        battle.effectsCreated++;
        seenPhases.add('catSlash');
        if (Math.hypot(player.x - enemy.x, player.y - enemy.y) <= 142) {
          const amount = Progression.rolledDamage(enemy.attack, player.defense);
          player.hp = Math.max(0, player.hp - amount);
          healFromPotions();
          battle.dogHurt = .34;
          floater('-' + amount, player.x, player.y - 115, '#ff9f8a');
          seenPhases.add('dogHit');
          updateHud();
          persistProfile();
          if (player.hp === 0) { onDogDefeat(); break; }
        }
      }
      if (action.elapsed >= timing.duration) {
        action.active = false;
        action.cooldown = timing.cooldown;
      }
    }

    battle.effects = battle.effects.filter(effect => (effect.age += dt) < effect.duration);
    battle.floaters = battle.floaters.filter(item => (item.age += dt) < item.duration);
    for (const item of battle.loot) {
      if (item.map !== currentMap) continue;
      item.age += dt;
      if (Math.hypot(player.x - item.x, player.y - item.y) <= 48) {
        if (!Loot.collect(item, player, inventory)) continue;
        if (item.kind === 'potion') {
          floater('+1 紅色藥水', player.x, player.y - 105, '#ffaca4', 16);
          healFromPotions();
        } else {
          floater('+' + item.amount + ' 金幣', player.x, player.y - 105, '#ffe177', 17);
        }
        updateHud();
        persistProfile();
      }
    }
    battle.loot = battle.loot.filter(item => !item.collected);
  }

  function updateMovement(dt) {
    let vx = joystick.x + (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
    let vy = joystick.y + (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
    const length = Math.hypot(vx, vy);
    if (length <= .07) { player.step = 0; return false; }
    vx /= Math.max(1, length);
    vy /= Math.max(1, length);
    player.facing = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 2 : 3) : (vy < 0 ? 1 : 0);
    const oldX = player.x, oldY = player.y;
    const ground = terrain();
    const dx = vx * Chase.dogSpeed * dt, dy = vy * Chase.dogSpeed * dt;
    if (ground.move) {
      const next = ground.move(player.x, player.y, dx, dy);
      player.x = next.x; player.y = next.y;
    } else {
      const nx = player.x + dx, ny = player.y + dy;
      if (ground.canStand(nx, ny)) { player.x = nx; player.y = ny; }
      else {
        if (ground.canStand(nx, player.y)) player.x = nx;
        if (ground.canStand(player.x, ny)) player.y = ny;
      }
    }
    const moved = Math.hypot(player.x - oldX, player.y - oldY) > .2;
    if (moved) {
      player.step += dt * 7;
      if (battle.dog.active) battle.movedDuringAttack = true;
    }
    else { player.step = 0; battle.blocked = .85; }
    return moved;
  }

  function drawCell(image, columns, rows, col, row, x, feetY, drawHeight, flip = false) {
    const cellW = image.width / columns;
    const cellH = image.height / rows;
    const drawWidth = drawHeight * cellW / cellH;
    ctx.save();
    if (flip) { ctx.translate(x, 0); ctx.scale(-1, 1); x = 0; }
    ctx.drawImage(image, col * cellW, row * cellH, cellW, cellH,
      x - drawWidth / 2, feetY - drawHeight, drawWidth, drawHeight);
    ctx.restore();
  }

  function drawSeparatedCell(image, layout, col, row, x, feetY, drawHeight) {
    const sx = layout.x[row][col], sy = layout.y[row];
    const sw = layout.x[row][col + 1] - sx;
    const sh = layout.y[row + 1] - sy;
    const factor = drawHeight / (image.height / (layout.y.length - 1));
    const sourceCenterX = (col + .5) * image.width / 4;
    const sourceFeetY = layout.feet[row][col];
    ctx.drawImage(image, sx, sy, sw, sh,
      x + (sx - sourceCenterX) * factor,
      feetY + (sy - sourceFeetY) * factor,
      sw * factor, sh * factor);
  }

  function drawAttackCell(image, layout, col, row, x, feetY, drawHeight) {
    const [y0, y1] = [layout.y[row], layout.y[row + 1]];
    const left = col === 0 ? [[y0, 0], [y1, 0]] : layout.seams[row][col - 1];
    const right = col === 3 ? [[y0, image.width], [y1, image.width]] : layout.seams[row][col];
    // Attack panels have two rows, but the dog is drawn at the same source-pixel
    // size as the three-row walking panels. Match the character scale, not row height.
    const factor = drawHeight / (image.height / 3);
    const centerX = (col + .5) * image.width / 4;
    ctx.save();
    ctx.translate(x - centerX * factor, feetY - layout.feet[row][col] * factor);
    ctx.scale(factor, factor);
    ctx.beginPath();
    ctx.moveTo(left[0][1], y0);
    ctx.lineTo(right[0][1], y0);
    for (let i = 1; i < right.length; i++) ctx.lineTo(right[i][1], right[i][0]);
    ctx.lineTo(left[left.length - 1][1], y1);
    for (let i = left.length - 2; i >= 0; i--) ctx.lineTo(left[i][1], left[i][0]);
    ctx.closePath();
    ctx.clip();
    const sx = Math.min(...left.map(point => point[1]));
    const ex = Math.max(...right.map(point => point[1]));
    ctx.drawImage(image, sx, y0, ex - sx, y1 - y0, sx, y0, ex - sx, y1 - y0);
    ctx.restore();
  }

  function drawShadow(x, y, radius) {
    ctx.fillStyle = 'rgba(10, 27, 19, .27)';
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * .28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBar(x, y, value, max, label, color) {
    const barW = 75 * scale;
    const barH = 5 * scale;
    ctx.textAlign = 'center';
    ctx.font = `600 ${11 * scale}px "PingFang TC", sans-serif`;
    ctx.fillStyle = '#fff8df';
    ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 4;
    ctx.fillText(label, x, y - 6 * scale);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(10,24,18,.7)';
    ctx.fillRect(x - barW / 2, y, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(x - barW / 2, y, barW * value / max, barH);
  }

  function traceSmoothPath(points, left, top, closed) {
    const p = points.map(([x, y]) => [left + x * scale, top + y * scale]);
    ctx.beginPath();
    if (closed) {
      const last = p[p.length - 1], first = p[0];
      ctx.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2);
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(...p[0]);
      for (let i = 1; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      ctx.lineTo(...p[p.length - 1]);
    }
  }

  function drawBoundaryGuides(left, top) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(left + player.x * scale, top + player.y * scale, 185 * scale, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#dbf7ae';
    ctx.shadowBlur = 6 * scale;
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = 'rgba(224,255,174,.31)';
    traceSmoothPath(Terrain.clearing, left, top, true);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(224,255,174,.22)';
    for (const trail of Terrain.connectors) {
      traceSmoothPath(trail.points, left, top, false);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLoot(left, top) {
    for (const item of battle.loot) {
      if (item.map !== currentMap) continue;
      const x = left + item.x * scale;
      const y = top + item.y * scale - Math.sin(item.age * 5) * 3 * scale;
      const size = 44 * scale;
      ctx.save();
      ctx.shadowColor = item.kind === 'potion' ? '#ff7068' : '#ffe279';
      ctx.shadowBlur = 12 * scale;
      if (item.kind === 'potion') {
        const sourceW = images.townItems.width / 4;
        const sourceH = images.townItems.height / 2;
        ctx.drawImage(images.townItems, sourceW * 2, sourceH, sourceW, sourceH,
          x - size * .42, y - size, size * .84, size);
      } else {
        ctx.drawImage(images.coins, x - size / 2, y - size, size, size);
      }
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.font = 'bold ' + Math.round(12 * scale) + 'px sans-serif';
      ctx.fillStyle = item.kind === 'potion' ? '#ffc0b5' : '#ffe48a';
      ctx.shadowColor = 'rgba(0,0,0,.85)';
      ctx.shadowBlur = 4;
      ctx.fillText(item.kind === 'potion' ? '紅色藥水' : String(item.amount),
        x, y - size - 2 * scale);
      ctx.shadowBlur = 0;
    }
  }

  function softenSwordArtCells() {
    // The generated light trails touch cell edges. Feather them once at load
    // so no rectangular atlas seam appears during a sword technique.
    const source = images.swordArts;
    const sheet = document.createElement('canvas');
    sheet.width = source.width; sheet.height = source.height;
    const painter = sheet.getContext('2d', { willReadFrequently: true });
    painter.drawImage(source, 0, 0);
    const pixels = painter.getImageData(0, 0, sheet.width, sheet.height);
    const rgba = pixels.data;
    const cellW = sheet.width / 3, cellH = sheet.height / 3;
    for (let y = 0; y < sheet.height; y++) {
      const edgeY = Math.min(y % cellH, cellH - (y % cellH));
      const fadeY = Math.min(1, edgeY / 42);
      for (let x = 0; x < sheet.width; x++) {
        const edgeX = Math.min(x % cellW, cellW - (x % cellW));
        const fadeX = Math.min(1, edgeX / 65);
        const alphaAt = (y * sheet.width + x) * 4 + 3;
        const alpha = rgba[alphaAt];
        const hazeFade = Math.min(1, Math.max(0, (alpha - 18) / 90));
        rgba[alphaAt] = Math.round(alpha * Math.min(fadeX, fadeY) * hazeFade);
      }
    }
    painter.putImageData(pixels, 0, 0);
    images.swordArts = sheet;
  }

  function drawAttackEffects(left, top) {
    for (const effect of battle.effects) {
      const direction = effect.direction;
      const x = left + (effect.x + direction * (effect.weapon ? 83 : 55)) * scale;
      const y = top + (effect.y - 86) * scale;
      const progress = effect.age / effect.duration;
      if (effect.owner === 'dog' && effect.weapon) {
        const row = { greatsword: 0, yitian: 1, imperial: 2 }[effect.weapon];
        const frame = Math.min(2, Math.floor(progress * 3));
        const image = images.swordArts;
        const cellW = image.width / 3, cellH = image.height / 3;
        const drawW = ({ greatsword: 230, yitian: 275, imperial: 315 }[effect.weapon]) * scale;
        const drawH = drawW * cellH / cellW;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.min(1, (1 - progress) * 1.7);
        ctx.shadowColor = effect.weapon === 'imperial' ? '#ff9a20' : effect.weapon === 'yitian' ? '#42baff' : '#ffd68a';
        ctx.shadowBlur = 17 * scale;
        if (direction < 0) { ctx.translate(x, 0); ctx.scale(-1, 1); }
        ctx.drawImage(image, frame * cellW, row * cellH, cellW, cellH,
          (direction < 0 ? 0 : x) - drawW / 2, y - drawH / 2, drawW, drawH);
        ctx.restore();
        continue;
      }
      const frame = progress < .5 ? 0 : 1;
      const cellW = images.slash.width / 2;
      const drawW = 112 * scale;
      const drawH = drawW * images.slash.height / cellW;
      ctx.save();
      ctx.globalAlpha = Math.sin(Math.PI * progress);
      if (direction < 0) { ctx.translate(x, 0); ctx.scale(-1, 1); }
      const centerX = direction < 0 ? 0 : x;
      ctx.drawImage(images.slash, frame * cellW, 0, cellW, images.slash.height,
        centerX - drawW / 2, y - drawH / 2, drawW, drawH);
      ctx.restore();
    }
  }

  function drawImperialFlame(dogX, dogY) {
    if (inventory.weapon !== 'imperial' || !battle.dog.active) return;
    const frames = [images.imperialFlame1, images.imperialFlame2, images.imperialFlame3];
    const frame = Math.floor(battle.dog.elapsed / .11) % frames.length;
    const size = 188 * scale;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = .9;
    ctx.shadowColor = '#f42a13';
    ctx.shadowBlur = 11 * scale;
    ctx.drawImage(frames[frame], dogX - size / 2, dogY - size + 8 * scale, size, size);
    ctx.restore();
  }

  function drawMaxLevelFlame(dogX, dogY, front) {
    if (player.level !== Progression.maxLevel || !images.maxLevelFlames) return;
    const frame = Math.floor(performance.now() / 120) % 5;
    const image = images.maxLevelFlames[frame];
    const drawWidth = 120 * scale;
    const drawHeight = drawWidth * image.height / image.width;
    const top = dogY - 48 * scale;
    const sourceY = front ? image.height / 2 : 0;
    ctx.drawImage(image, 0, sourceY, image.width, image.height / 2,
      dogX - drawWidth / 2, top + (front ? drawHeight / 2 : 0),
      drawWidth, drawHeight / 2);
  }

  function drawLevelUp(dogX, dogY) {
    if (battle.levelUp <= 0) return;
    const progress = 1 - battle.levelUp / 1.5;
    const frame = Math.min(2, Math.floor(progress * 3));
    seenLevelFrames.add(frame);
    const image = [images.level1, images.level2, images.level3][frame];
    const size = 190 * scale;
    ctx.save();
    ctx.globalAlpha = Math.min(1, battle.levelUp * 2);
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(image, dogX - size / 2, dogY - size * .78, size, size);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + Math.round(21 * scale) + 'px Georgia, serif';
    ctx.fillStyle = '#fff6b3';
    ctx.shadowColor = '#dba829';
    ctx.shadowBlur = 12 * scale;
    ctx.fillText('升級！Lv.' + battle.levelReached, dogX, dogY - 157 * scale);
    ctx.shadowBlur = 0;
  }

  function drawFloaters(left, top) {
    for (const item of battle.floaters) {
      const progress = item.age / item.duration;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - progress) * 1.8);
      ctx.textAlign = 'center';
      ctx.font = 'bold ' + Math.round(item.size * scale) + 'px sans-serif';
      ctx.fillStyle = item.color;
      ctx.lineWidth = 3 * scale;
      ctx.strokeStyle = 'rgba(24,32,25,.85)';
      const x = left + item.x * scale;
      const y = top + (item.y - progress * 42) * scale;
      ctx.strokeText(item.text, x, y);
      ctx.fillText(item.text, x, y);
      ctx.restore();
    }
  }

  function drawDaoist(left, top) {
    const bx = left + daoist.x * scale, by = top + daoist.y * scale;
    const exitX = left + 620 * scale, exitY = top + 785 * scale;
    ctx.save();
    ctx.globalAlpha = .82 + Math.sin(performance.now() / 300) * .14;
    ctx.drawImage(images.townItems, images.townItems.width * .75, images.townItems.height * .5,
      images.townItems.width * .25, images.townItems.height * .5,
      exitX - 25 * scale, exitY - 48 * scale, 50 * scale, 50 * scale);
    ctx.restore();
    if (daoist.defeated) return;

    if (daoist.phase === 'lightning') {
      const key = ['daoistLightning1', 'daoistLightning2', 'daoistLightning3'][daoist.waveIndex];
      const effect = images[key];
      const size = [[350, 330], [600, 400], [900, 500]][daoist.waveIndex];
      ctx.drawImage(effect, bx - size[0] * scale / 2, by - size[1] * scale * .75,
        size[0] * scale, size[1] * scale);
    }

    drawShadow(bx, by, 39 * scale);
    let sprite = images.daoistIdle;
    if (daoist.phase === 'cast') sprite = images[daoist.timer < .12 ? 'daoistCast1' :
      daoist.timer < .24 ? 'daoistCast2' : 'daoistCast3'];
    if (daoist.phase === 'hop') sprite = images.daoistHop;
    const drawH = 178 * scale, drawW = drawH * sprite.width / sprite.height;
    const hop = daoist.phase === 'hop' ? Math.sin(daoist.timer / .325 * Math.PI) * 20 * scale : 0;
    ctx.drawImage(sprite, bx - drawW / 2, by - drawH - hop, drawW, drawH);

    if (daoist.shield) {
      const size = 225 * scale;
      ctx.drawImage(images.daoistShield, bx - size / 2, by - size * .94, size, size);
      ctx.textAlign = 'center';
      ctx.font = 'bold ' + Math.round(24 * scale) + 'px sans-serif';
      ctx.fillStyle = '#eaf8ff';
      ctx.shadowColor = '#6acbff'; ctx.shadowBlur = 12 * scale;
      ctx.fillText(String(Math.max(1, Math.ceil((3 - daoist.timer) / daoist.attackSpeed))),
        bx, by - 218 * scale);
      ctx.shadowBlur = 0;
    }
    if (daoist.phase === 'explosion') {
      const progress = daoist.timer / .325;
      const size = (180 + progress * 240) * scale;
      ctx.save(); ctx.globalAlpha = 1 - progress * .65;
      ctx.drawImage(images.daoistExplosion, bx - size / 2, by - size * .62, size, size);
      ctx.restore();
    }
    drawBar(bx, by - 192 * scale, daoist.hp, daoist.maxHp,
      daoist.engaged ? '黑犬道士 ' + daoist.hp + '/' + daoist.maxHp : '黑犬道士', '#91c0e9');
  }

  function drawDaoistFireballs(left, top) {
    for (const ball of daoist.fireballs) {
      const x = left + ball.x * scale, y = top + ball.y * scale;
      const drawH = DaoistBoss.projectileDiameter * 1.95 * scale;
      const image = images.daoistFireball;
      const drawW = drawH * image.width / image.height;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(ball.vy, ball.vx));
      ctx.drawImage(image, -drawW * .77, -drawH / 2, drawW, drawH);
      ctx.restore();
    }
  }

  function drawScene(walking) {
    const visibleW = width / scale;
    const visibleH = height / scale;
    const ground = terrain();
    const horizontalHudOffset = width < 500 ? 48 / scale : 0;
    const cameraX = clamp(camera.x - horizontalHudOffset, visibleW / 2, ground.width - visibleW / 2);
    const cameraY = clamp(camera.y, visibleH / 2, ground.height - visibleH / 2);
    const left = width / 2 - cameraX * scale;
    const top = height / 2 - cameraY * scale;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#183d2e';
    ctx.fillRect(0, 0, width, height);
    const mapImage = currentMap === 'town' ? images.townMap : currentMap === 'river' ? images.riverMap :
      currentMap === 'altar' ? images.altarMap : images.map;
    const sourceX = clamp(-left / scale, 0, ground.width);
    const sourceY = clamp(-top / scale, 0, ground.height);
    const sourceW = Math.min(ground.width - sourceX, width / scale);
    const sourceH = Math.min(ground.height - sourceY, height / scale);
    if (sourceW > 0 && sourceH > 0) {
      ctx.drawImage(mapImage, sourceX, sourceY, sourceW, sourceH,
        left + sourceX * scale, top + sourceY * scale, sourceW * scale, sourceH * scale);
    }
    if (terrainDebug) {
      for (let y = 12; y < ground.height; y += 24) {
        for (let x = 12; x < ground.width; x += 24) {
          ctx.fillStyle = ground.canStand(x, y) ? 'rgba(89, 235, 95, .42)' : 'rgba(226, 62, 54, .32)';
          ctx.fillRect(left + (x - 11) * scale, top + (y - 11) * scale, 22 * scale, 22 * scale);
        }
      }
    }
    if (currentMap === 'forest') drawBoundaryGuides(left, top);

    const dogX = left + player.x * scale;
    const dogY = top + player.y * scale;
    const visibleEnemies = currentMap === 'forest' ? forestCats : currentMap === 'river' ? eliteCats : [];
    const focus = visibleEnemies.filter(enemy => enemy.hp > 0)
      .sort((a, b) => Math.hypot(player.x - a.x, player.y - a.y) -
        Math.hypot(player.x - b.x, player.y - b.y))[0] ||
      (currentMap === 'altar' && !daoist.defeated ? daoist : null);
    const dogFlip = focus ? player.x > focus.x : false;

    if (currentMap === 'forest') {
      for (const enemy of [...forestCats].sort((a, b) => a.y - b.y)) {
        if (enemy.hp === 0) continue;
        const catX = left + enemy.x * scale, catY = top + enemy.y * scale;
        drawShadow(catX, catY, 33 * scale);
        let catCol = 0, catRow = 0;
        if (enemy.hurt > 0) { catCol = Math.floor(enemy.hurt * 12) % 2; catRow = 1; }
        else if (enemy.action.active) catCol = enemy.action.elapsed < .36 ? 1 : 2;
        if (enemy.hurt === 0 && !enemy.action.active) {
          const catWalkFrame = enemy.moving ? 1 + Math.floor(enemy.step) % 2 : 0;
          drawSeparatedCell(images.catWalk, SpriteLayouts.cat,
            enemy.facing, catWalkFrame, catX, catY, 115 * scale);
        } else {
          drawCell(images.cat, 3, 2, catCol, catRow, catX, catY, 115 * scale, enemy.x < player.x);
        }
        drawBar(catX, catY - 128 * scale, enemy.hp, enemy.maxHp,
          '遊俠貓 ' + enemy.hp + '/' + enemy.maxHp, '#e5a15d');
      }
      // A small painted gateway marker identifies the northern stair exit.
      const portalX = left + 878 * scale, portalY = top + 160 * scale;
      ctx.globalAlpha = .82 + Math.sin(performance.now() / 300) * .14;
      ctx.drawImage(images.townItems, images.townItems.width * .75, images.townItems.height * .5,
        images.townItems.width * .25, images.townItems.height * .5,
        portalX - 25 * scale, portalY - 48 * scale, 50 * scale, 50 * scale);
      const riverPortalX = left + 1201 * scale, riverPortalY = top + 758 * scale;
      ctx.drawImage(images.townItems, images.townItems.width * .75, images.townItems.height * .5,
        images.townItems.width * .25, images.townItems.height * .5,
        riverPortalX - 25 * scale, riverPortalY - 48 * scale, 50 * scale, 50 * scale);
      const altarPortalX = left + 1430 * scale, altarPortalY = top + 280 * scale;
      ctx.drawImage(images.townItems, images.townItems.width * .75, images.townItems.height * .5,
        images.townItems.width * .25, images.townItems.height * .5,
        altarPortalX - 25 * scale, altarPortalY - 48 * scale, 50 * scale, 50 * scale);
      ctx.globalAlpha = 1;
    } else if (currentMap === 'river') {
      for (const elite of eliteCats) {
        if (elite.hp === 0) continue;
        const ex = left + elite.x * scale, ey = top + elite.y * scale;
        drawShadow(ex, ey, 36 * scale);
        ctx.save();
        ctx.strokeStyle = '#f0d381';
        ctx.lineWidth = 2.5 * scale;
        ctx.beginPath(); ctx.ellipse(ex, ey, 35 * scale, 12 * scale, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        const attackFrame = Progression.attackPose(elite, elite.action);
        if (attackFrame) seenEliteAttackFrames.add(attackFrame);
        const sprite = attackFrame === 1 ? images.eliteWindup :
          attackFrame === 2 ? images.eliteSlash : images.eliteCat;
        const eliteHeight = (attackFrame ? 145 : 125) * scale;
        const eliteWidth = eliteHeight * sprite.width / sprite.height;
        const flip = attackFrame ? player.x < elite.x : elite.facing === 2;
        const lunge = attackFrame === 2 ? (flip ? -9 : 9) * scale : 0;
        ctx.save();
        if (flip) { ctx.translate(ex, 0); ctx.scale(-1, 1); }
        ctx.drawImage(sprite,
          (flip ? 0 : ex) - eliteWidth / 2 + (flip ? -lunge : lunge), ey - eliteHeight,
          eliteWidth, eliteHeight);
        ctx.restore();
        drawBar(ex, ey - 133 * scale, elite.hp, elite.maxHp,
          '精英遊俠貓 ' + elite.hp + '/' + elite.maxHp, '#e9c461');
      }
      // Return marker sits at the foot of the upper staircase.
      const stairX = left + 1094 * scale, stairY = top + 268 * scale;
      ctx.save();
      ctx.globalAlpha = .82 + Math.sin(performance.now() / 300) * .14;
      ctx.drawImage(images.townItems, images.townItems.width * .75, images.townItems.height * .5,
        images.townItems.width * .25, images.townItems.height * .5,
        stairX - 25 * scale, stairY - 48 * scale, 50 * scale, 50 * scale);
      ctx.restore();
    } else if (currentMap === 'altar') {
      drawDaoist(left, top);
    } else {
      for (const merchant of Object.values(Shops.merchants)) {
        const mx = left + merchant.x * scale, my = top + merchant.y * scale;
        drawShadow(mx, my, 29 * scale);
        drawCell(images.merchants, 3, 1, merchant.sprite, 0, mx, my, 124 * scale);
        ctx.save();
        ctx.textAlign = 'center'; ctx.font = `bold ${13 * scale}px sans-serif`;
        ctx.fillStyle = '#fff7dc'; ctx.strokeStyle = '#1c291f'; ctx.lineWidth = 3 * scale;
        ctx.strokeText(merchant.name, mx, my - 131 * scale);
        ctx.fillText(merchant.name, mx, my - 131 * scale);
        ctx.restore();
      }
    }

    drawShadow(dogX, dogY, 35 * scale);
    drawMaxLevelFlame(dogX, dogY, false);
    const dogFeetY = dogY - (walking ? Math.abs(Math.sin(player.step * Math.PI)) * 2 * scale : 0);
    if (images.outfit) {
      // Each frame is a complete, dressed character holding the equipped sword.
      // Move the whole illustration together so no separate equipment can drift.
      const attack = battle.dog.active ? Math.sin(Math.min(1, battle.dog.elapsed / .62) * Math.PI) : 0;
      const direction = player.facing === 2 ? -1 : player.facing === 3 ? 1 : !focus || focus.x >= player.x ? 1 : -1;
      const lunge = attack * direction * 7 * scale;
      const hurt = battle.dogHurt > 0 ? Math.sin(battle.dogHurt * 45) * 3 * scale : 0;
      const bob = walking ? Math.abs(Math.sin(player.step * Math.PI)) * 3 * scale : 0;
      const outfitKey = (inventory.armor || 'none') + '-' + (inventory.weapon || 'none');
      if (battle.dog.active) {
        const attackFrame = battle.dog.elapsed < .2 ? 0 : 1;
        drawAttackCell(images.outfitAttack, AttackLayouts[outfitKey], player.facing, attackFrame,
          dogX + lunge, dogY, 132 * scale);
      } else {
        const outfitFrame = walking && battle.dogHurt === 0 ? 1 + Math.floor(player.step) % 2 : 0;
        drawSeparatedCell(images.outfit, SpriteLayouts[outfitKey], player.facing, outfitFrame,
          dogX + hurt, dogY - bob, 132 * scale);
      }
    } else if (battle.dogHurt > 0) {
      const hurtCol = Math.floor(battle.dogHurt * 11) % 2;
      drawCell(images.dogCombat, 2, 2, hurtCol, 1, dogX, dogY, 140 * scale, dogFlip);
    } else if (battle.dog.active) {
      const attackCol = battle.dog.elapsed < .2 ? 0 : 1;
      drawCell(images.dogCombat, 2, 2, attackCol, 0, dogX, dogY, 140 * scale, dogFlip);
    } else if (walking) {
      const walkFrame = Math.floor(player.step) % 2;
      seenWalkFrames.add(walkFrame);
      drawCell(images.walk, 4, 2, player.facing, walkFrame, dogX, dogFeetY, 137 * scale);
    } else {
      drawCell(images.idle, 4, 1, player.facing, 0, dogX, dogY, 132 * scale);
    }

    drawMaxLevelFlame(dogX, dogY, true);
    drawImperialFlame(dogX, dogY);

    if (currentMap !== 'town') drawLoot(left, top);
    if (currentMap === 'altar') drawDaoistFireballs(left, top);
    if (currentMap !== 'town') drawAttackEffects(left, top);
    drawLevelUp(dogX, dogY);
    drawFloaters(left, top);
  }

  function frame(time) {
    const dt = Math.min((time - lastTime) / 1000 || 0, .05);
    lastTime = time;
    fpsFrames++;
    if (time - fpsWindow >= 1000) {
      canvas.dataset.fps = String(Math.round(fpsFrames * 1000 / Math.max(1, time - fpsWindow)));
      if (drawSamples) canvas.dataset.drawMs = (drawTotal / drawSamples).toFixed(1);
      fpsFrames = 0; fpsWindow = time;
      drawTotal = 0; drawSamples = 0;
    }
    if (ready) {
      const walking = !hasEnteredGame || activeShop || storyState || endingShown ? false : updateMovement(dt);
      if (hasEnteredGame && !endingShown) updateBattle(dt);
      battle.blocked = Math.max(0, battle.blocked - dt);
      camera.x += (player.x - camera.x) * Math.min(1, dt * 7);
      camera.y += (player.y - (currentMap === 'altar' ? 90 : 0) - camera.y) * Math.min(1, dt * 7);
      const drawStart = performance.now();
      drawScene(walking);
      drawTotal += performance.now() - drawStart;
      drawSamples++;
      const currentEnemies = currentMap === 'forest' ? forestCats : currentMap === 'river' ? eliteCats : [];
      const attackingEnemy = currentEnemies.find(enemy => enemy.action.active);
      canvas.dataset.phase = battle.dog.active ? (battle.dog.hit ? 'dogSlash' : 'dogWindup') :
        attackingEnemy ? (attackingEnemy.action.hit ? 'catSlash' : 'catWindup') : 'idle';
      canvas.dataset.seenPhases = [...seenPhases].join(',');
      canvas.dataset.seenWalkFrames = [...seenWalkFrames].join(',');
      canvas.dataset.position = Math.round(player.x) + ',' + Math.round(player.y);
      canvas.dataset.level = String(player.level);
      canvas.dataset.experience = String(player.experience);
      canvas.dataset.gold = String(player.gold);
      canvas.dataset.dogHp = String(player.hp);
      canvas.dataset.catHp = String(cat.hp);
      canvas.dataset.forestCatCount = String(forestCats.length);
      canvas.dataset.forestCatPositions = forestCats.map(enemy =>
        Math.round(enemy.x) + ',' + Math.round(enemy.y)).join(';');
      canvas.dataset.attack = String(player.attack);
      canvas.dataset.defense = String(player.defense);
      canvas.dataset.map = currentMap;
      canvas.dataset.eliteCount = String(currentMap === 'river' ? eliteCats.length : 0);
      canvas.dataset.eliteAlive = String(eliteCats.filter(enemy => enemy.hp > 0).length);
      canvas.dataset.elitePositions = eliteCats.map(enemy =>
        Math.round(enemy.x) + ',' + Math.round(enemy.y)).join(';');
      canvas.dataset.eliteRespawnSeconds = String(EliteWave.secondsLeft(eliteRespawnAt, performance.now()));
      canvas.dataset.daoistPhase = currentMap === 'altar' ? daoist.phase : '';
      canvas.dataset.daoistHp = String(daoist.hp);
      canvas.dataset.daoistEngaged = String(daoist.engaged);
      canvas.dataset.fireballDiameter = String(DaoistBoss.projectileDiameter);
      canvas.dataset.weapon = inventory.weapon || '';
      canvas.dataset.armor = inventory.armor || '';
      canvas.dataset.outfitFrame = images.outfit
        ? String(walking && !battle.dog.active && battle.dogHurt === 0
          ? 1 + Math.floor(player.step) % 2 : 0) : '';
      canvas.dataset.attackFrame = battle.dog.active ? String(battle.dog.elapsed < .2 ? 0 : 1) : '';
      canvas.dataset.catPosition = Math.round(cat.x) + ',' + Math.round(cat.y);
      canvas.dataset.catMoving = String(cat.moving);
      canvas.dataset.catFrame = String(cat.moving && !cat.action.active && cat.hurt === 0
        ? 1 + Math.floor(cat.step) % 2 : 0);
      canvas.dataset.catSpeed = String(Chase.catSpeed);
      canvas.dataset.potions = String(inventory.potions);
      canvas.dataset.lootCount = String(battle.loot.length);
      canvas.dataset.movedDuringAttack = String(battle.movedDuringAttack);
      canvas.dataset.effectsCreated = String(battle.effectsCreated);
      canvas.dataset.seenLevelFrames = [...seenLevelFrames].join(',');
      canvas.dataset.seenEliteAttackFrames = [...seenEliteAttackFrames].join(',');
      nearbyAction = nearestAction();
      actionButton.classList.toggle('visible', !!nearbyAction && !activeShop && !storyState);
      if (nearbyAction) actionButton.textContent = nearbyAction.label;
      const nextTip = currentMap === 'town' ?
        storyEnabled && !Story.complete(seenClues)
          ? '與三位商人交談，蒐集線索<br>完成後從村莊右邊出發'
          : '線索已齊！從村莊右邊出發<br>靠近商人仍可交易' :
        currentMap === 'river' ? eliteRespawnAt !== null
          ? '精英遊俠貓已全數擊敗<br>' + EliteWave.secondsLeft(eliteRespawnAt, performance.now()) + ' 秒後五隻一起重現'
          : '精英貓掉落100金幣與紅色藥水<br>全數擊敗後，5秒一起重現' :
        currentMap === 'altar' ? nearbyAction
          ? '點按中央按鈕返回竹影迷林'
          : daoist.defeated ? '黑犬道士已敗<br>走向下方石階返回竹林'
          : daoist.engaged ? daoist.shield
            ? '護罩無敵，倒數後爆炸<br>道士正向你逼近'
            : '黑犬道士施法中<br>小心火球與三圈落雷'
          : '黑犬道士守在太極中央<br>靠近並攻擊後才會反擊' :
        nearbyAction ? nearbyAction.destination === 'river'
          ? '點按中央按鈕下石階<br>前往河心石臺' :
          nearbyAction.destination === 'altar' ? '點按中央按鈕前往禁忌天壇' :
            '點按中央按鈕前往古鎮<br>石階上方連接城鎮' :
        battle.blocked > 0 ? '柔光標出可走邊界<br>尋找橋或石階通行' :
        battle.dog.active || attackingEnemy ? '交鋒中，仍可移動<br>走近落下的金幣拾取' :
        '拖動右側搖桿探索竹林<br>北方通古鎮，右上通禁忌天壇';
      if (nextTip !== currentTip) { tip.innerHTML = nextTip; currentTip = nextTip; }
    }
    requestAnimationFrame(frame);
  }

  resize();
  if (storyEnabled || townPreview) {
    locationTitle.textContent = '汴河古鎮';
    canvas.setAttribute('aria-label', '汴河古鎮探索地圖');
  }
  if (riverPreview) {
    locationTitle.textContent = '河心石臺';
    canvas.setAttribute('aria-label', '河心石臺探索地圖');
  }
  if (altarPreview) {
    locationTitle.textContent = '禁忌天壇';
    canvas.setAttribute('aria-label', '禁忌天壇探索地圖');
  }
  updateHud();
  Promise.all([...Object.entries(assetPaths).map(([key, path]) => {
    const img = new Image();
    images[key] = img;
    img.src = path;
    return img.decode();
  }), loadOutfit(inventory).then(outfit => {
    images.outfit = outfit?.walk || null;
    images.outfitAttack = outfit?.attack || null;
  }), ...(player.level === Progression.maxLevel ? [loadMaxLevelFlames()] : [])]).then(() => {
    softenSwordArtCells();
    canvas.dataset.loadMs = String(Math.round(performance.now() - bootStart));
    ready = true;
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 400);
    if (startRequested) enterGame();
  }).catch(() => {
    loading.textContent = '素材載入失敗，請重新整理頁面';
    startButton.textContent = '載入失敗，請重新整理';
    startButton.disabled = true;
  });
  requestAnimationFrame(frame);

  // Read-only browser inspection for manual verification of terrain and combat.
  window.gameState = () => ({
    map: currentMap,
    inventory: { ...inventory, owned: [...inventory.owned] },
    player: { x: player.x, y: player.y, hp: player.hp, level: player.level,
      experience: player.experience, gold: player.gold, attack: player.attack, defense: player.defense },
    cat: { x: cat.x, y: cat.y, hp: cat.hp, respawn: cat.respawn },
    forestCats: forestCats.map(enemy => ({ id: enemy.id, x: enemy.x, y: enemy.y,
      hp: enemy.hp, maxHp: enemy.maxHp, attack: enemy.attack, action: { ...enemy.action } })),
    eliteCats: eliteCats.map(elite => ({ ...elite })),
    daoist: { x: daoist.x, y: daoist.y, hp: daoist.hp, engaged: daoist.engaged,
      shield: daoist.shield, phase: daoist.phase, spellIndex: daoist.spellIndex,
      waveIndex: daoist.waveIndex, fireballs: daoist.fireballs.map(ball => ({ ...ball })) },
    eliteRespawnSeconds: EliteWave.secondsLeft(eliteRespawnAt, performance.now()),
    dogAttacking: battle.dog.active,
    catAttacking: [...forestCats, ...eliteCats].some(enemy => enemy.action.active),
    lootCount: battle.loot.length
  });
})();
