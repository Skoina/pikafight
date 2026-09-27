// Walkable surface of the river platform painting. The staircase at the
// upper right joins the platform; water and the outer rail are impassable.
const RiverTerrain = (() => {
  const width = 1536, height = 1024;
  const platform = [
    [174, 352], [254, 285], [374, 244], [570, 229], [773, 238],
    [931, 252], [1032, 276], [1163, 295], [1252, 378], [1276, 485],
    [1212, 593], [1118, 651], [950, 680], [760, 697], [590, 677],
    [407, 654], [282, 594], [207, 509]
  ];
  function inside(x, y, points) {
    let hit = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a[1] > y) !== (b[1] > y) &&
          x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  }
  function isWalkable(x, y) {
    return inside(x, y, platform) ||
      (x >= 1025 && x <= 1160 && y >= 212 && y <= 315);
  }
  function canStand(x, y) {
    return [[0, 0], [-7, 0], [7, 0], [0, -6], [0, 6]]
      .every(([dx, dy]) => isWalkable(x + dx, y + dy));
  }
  function move(x, y, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    let px = x, py = y;
    for (let step = 0; step < steps; step++) {
      const nx = px + dx / steps, ny = py + dy / steps;
      if (canStand(nx, ny)) { px = nx; py = ny; }
      else {
        if (canStand(nx, py)) px = nx;
        if (canStand(px, ny)) py = ny;
      }
    }
    return { x: px, y: py };
  }
  return { width, height, isWalkable, canStand, move };
})();
if (typeof module !== 'undefined') module.exports = RiverTerrain;
