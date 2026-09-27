const DaoistBoss = (() => {
  const spawn = Object.freeze({ x: 768, y: 435 });
  const projectileDiameter = 132; // Matches the protagonist's usual drawn height.
  const lightningRings = Object.freeze([
    { count: 3, radius: 145 },
    { count: 6, radius: 260 },
    { count: 9, radius: 375 }
  ]);

  function create() {
    return {
      x: spawn.x, y: spawn.y, hp: 1000, maxHp: 1000, defense: 30,
      attackSpeed: 1.5,
      engaged: false, shield: false, phase: 'idle', timer: 0,
      spellIndex: 0, waveIndex: 0, waveHit: false,
      fireballs: [], defeated: false
    };
  }

  function hit(boss, damage) {
    if (boss.defeated || boss.shield) return 0;
    const dealt = Math.min(boss.hp, Math.max(0, damage));
    if (!dealt) return 0;
    boss.hp -= dealt;
    boss.engaged = true;
    if (boss.hp === 0) {
      boss.defeated = true;
      boss.phase = 'defeated';
      boss.shield = false;
      boss.fireballs.length = 0;
    } else if (boss.phase === 'idle') {
      boss.phase = 'cast'; boss.timer = 0;
    }
    return dealt;
  }

  function strikePositions(boss, waveIndex) {
    const ring = lightningRings[waveIndex];
    return Array.from({ length: ring.count }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / ring.count;
      return { x: boss.x + Math.cos(angle) * ring.radius,
        y: boss.y + Math.sin(angle) * ring.radius * .58 };
    });
  }

  function endSpell(boss) {
    boss.spellIndex = (boss.spellIndex + 1) % 3;
    boss.phase = 'cooldown'; boss.timer = 0;
  }

  function update(boss, player, dt, ground) {
    const hits = [];
    boss.fireballs = boss.fireballs.filter(ball => {
      ball.x += ball.vx * 410 * dt;
      ball.y += ball.vy * 410 * dt;
      if (Math.hypot(ball.x - player.x, ball.y - (player.y - 66)) <= projectileDiameter / 2 + 30) {
        hits.push({ type: 'fireball', damage: 55 });
        return false;
      }
      return ball.x >= -projectileDiameter && ball.x <= ground.width + projectileDiameter &&
        ball.y >= -projectileDiameter && ball.y <= ground.height + projectileDiameter;
    });
    if (!boss.engaged || boss.defeated) return hits;

    boss.timer += dt * boss.attackSpeed;
    if (boss.phase === 'cast' && boss.timer >= .36) {
      boss.timer = 0;
      if (boss.spellIndex === 0) {
        const dx = player.x - boss.x, dy = player.y - 66 - (boss.y - 86);
        const length = Math.hypot(dx, dy) || 1;
        const vx = dx / length, vy = dy / length;
        boss.fireballs.push({ x: boss.x + vx * 85, y: boss.y - 86 + vy * 85, vx, vy });
        boss.phase = 'hop';
      } else if (boss.spellIndex === 1) {
        boss.phase = 'lightning'; boss.waveIndex = 0; boss.waveHit = false;
      } else {
        boss.phase = 'shield'; boss.shield = true;
      }
    } else if (boss.phase === 'hop') {
      const dx = boss.x - player.x, dy = boss.y - player.y;
      const length = Math.hypot(dx, dy) || 1;
      const hopSpeed = 130 * boss.attackSpeed * 2;
      const next = ground.move(boss.x, boss.y, dx / length * hopSpeed * dt,
        dy / length * hopSpeed * dt);
      boss.x = next.x; boss.y = next.y;
      if (boss.timer >= .325) endSpell(boss);
    } else if (boss.phase === 'lightning') {
      if (!boss.waveHit && boss.timer >= .07) {
        boss.waveHit = true;
        strikePositions(boss, boss.waveIndex).forEach((point, strike) => {
          if (Math.hypot(point.x - player.x, point.y - player.y) <= 48)
            hits.push({ type: 'lightning', strike, damage: 55 });
        });
      }
      if (boss.timer >= .29) {
        boss.waveIndex++;
        boss.timer = 0; boss.waveHit = false;
        if (boss.waveIndex === lightningRings.length) endSpell(boss);
      }
    } else if (boss.phase === 'shield') {
      const dx = player.x - boss.x, dy = player.y - boss.y;
      const length = Math.hypot(dx, dy) || 1;
      if (length > 105) {
        const approachSpeed = 90 * boss.attackSpeed;
        const next = ground.move(boss.x, boss.y, dx / length * approachSpeed * dt,
          dy / length * approachSpeed * dt);
        boss.x = next.x; boss.y = next.y;
      }
      if (boss.timer >= 3) {
        boss.shield = false;
        boss.phase = 'explosion'; boss.timer = 0;
        if (Math.hypot(player.x - boss.x, player.y - boss.y) <= 205)
          hits.push({ type: 'explosion', damage: 80 });
      }
    } else if (boss.phase === 'explosion' && boss.timer >= .325) {
      endSpell(boss);
    } else if (boss.phase === 'cooldown' && boss.timer >= .4) {
      boss.phase = 'cast'; boss.timer = 0;
    }
    return hits;
  }

  return { spawn, projectileDiameter, lightningRings, create, hit, strikePositions, update };
})();

if (typeof module !== 'undefined') module.exports = DaoistBoss;
