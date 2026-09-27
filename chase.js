const Chase = (() => {
  const dogSpeed = 205;
  const catSpeed = dogSpeed * 0.7;
  const stopDistance = 112;

  function inView(x, y, cameraX, cameraY, visibleW, visibleH) {
    // The sprite can start walking as soon as any part enters the screen.
    const margin = 45;
    return Math.abs(x - cameraX) <= visibleW / 2 + margin &&
      Math.abs(y - cameraY) <= visibleH / 2 + margin;
  }

  function advance(cat, player, dt, ground) {
    const dx = player.x - cat.x, dy = player.y - cat.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= stopDistance || dt <= 0) return { x: cat.x, y: cat.y, moved: false };
    const maximum = Math.min(catSpeed * dt, distance - stopDistance);
    const next = ground.move(cat.x, cat.y, dx / distance * maximum, dy / distance * maximum);
    let moveX = next.x - cat.x, moveY = next.y - cat.y;
    const actual = Math.hypot(moveX, moveY);
    if (actual > maximum + 0.001) {
      const ratio = maximum / actual;
      moveX *= ratio; moveY *= ratio;
      if (!ground.canStand(cat.x + moveX, cat.y + moveY)) return { x: cat.x, y: cat.y, moved: false };
    }
    return { x: cat.x + moveX, y: cat.y + moveY, moved: Math.hypot(moveX, moveY) > 0.1 };
  }

  return { dogSpeed, catSpeed, stopDistance, inView, advance };
})();

if (typeof module !== 'undefined') module.exports = Chase;
