// Coordinates match the 1536 × 1024 Forbidden Heavenly Altar painting.
const AltarTerrain = (() => {
  const width = 1536;
  const height = 1024;

  function canStand(x, y) {
    // The raised ruins and broken balustrades remain outside the arena.
    const arena = x >= 218 && x <= 1320 && y >= 176 && y <= 762;
    const entrance = x >= 485 && x <= 755 && y > 762 && y <= 880;
    return arena || entrance;
  }

  function move(x, y, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 9));
    let px = x, py = y;
    for (let i = 0; i < steps; i++) {
      const nx = px + dx / steps, ny = py + dy / steps;
      if (canStand(nx, ny)) { px = nx; py = ny; }
      else if (canStand(nx, py)) px = nx;
      else if (canStand(px, ny)) py = ny;
    }
    return { x: px, y: py };
  }

  return { width, height, canStand, move };
})();

if (typeof module !== 'undefined') module.exports = AltarTerrain;
