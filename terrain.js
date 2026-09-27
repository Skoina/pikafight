// Coordinates refer to the approved 1536 × 1024 jungle painting.
// The ground is traced from the visible paths; narrow connectors are the
// bridge and stairs. A sheer drop never connects two walkable regions.
const Terrain = (() => {
  const width = 1536;
  const height = 1024;

  const clearing = [
    [375, 284], [440, 247], [535, 214], [635, 212], [728, 235],
    [793, 271], [853, 298], [934, 274], [1003, 249], [1057, 276],
    [1089, 333], [1172, 321], [1234, 304], [1342, 318], [1518, 306],
    [1535, 659], [1475, 701], [1378, 676], [1298, 635], [1211, 616],
    [1148, 608], [1074, 590], [1007, 564], [923, 586], [845, 561],
    [752, 571], [677, 543], [593, 552], [513, 518], [429, 511],
    [370, 463], [346, 391]
  ];

  const connectors = [
    // The wooden bridge across the stream and the trail on its west bank.
    { name: 'bridge', radius: 31, points: [[445, 356], [390, 354], [339, 342], [289, 342], [256, 321]] },
    { name: 'west trail', radius: 46, points: [[256, 321], [224, 283], [167, 252], [93, 246], [28, 260]] },
    // The northern stone stairs; the high ledge on either side is closed.
    { name: 'north stairs', radius: 40, points: [[790, 309], [829, 268], [858, 219], [879, 169], [871, 124], [908, 79], [940, 27]] },
    // Steps descend toward the lower eastern edge, ending before the cliff.
    { name: 'east stairs', radius: 36, points: [[1212, 603], [1254, 646], [1270, 689], [1223, 721], [1201, 758]] },
    // Pale trails remain usable where they pass between trees on the east.
    { name: 'east upper road', radius: 40, points: [[1159, 376], [1240, 333], [1340, 296], [1430, 279], [1510, 281]] },
    { name: 'east lower road', radius: 41, points: [[1378, 607], [1456, 660], [1504, 715]] }
  ];

  // Prominent raised rock outcrops inside the otherwise open clearing.
  const raisedGround = [
    [[577, 374], [628, 349], [690, 365], [731, 412], [713, 461], [658, 489], [596, 467], [563, 422]]
  ];

  function insidePolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a[1] > y) !== (b[1] > y) &&
          x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  function nearestPoint(x, y, trail) {
    let nearest = { distance: Infinity, x: 0, y: 0 };
    for (let i = 1; i < trail.points.length; i++) {
      const a = trail.points[i - 1], b = trail.points[i];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
      const px = a[0] + t * dx, py = a[1] + t * dy;
      const distance = Math.hypot(x - px, y - py);
      if (distance < nearest.distance) nearest = { distance, x: px, y: py };
    }
    return nearest;
  }

  function distanceToEdges(x, y, points) {
    let closest = Infinity;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
      closest = Math.min(closest, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
    }
    return closest;
  }

  function isWalkable(x, y) {
    if (x < 16 || y < 14 || x > width - 16 || y > height - 16) return false;
    if (raisedGround.some(points => insidePolygon(x, y, points))) return false;
    if (insidePolygon(x, y, clearing) || distanceToEdges(x, y, clearing) <= 18) return true;
    return connectors.some(trail => nearestPoint(x, y, trail).distance <= trail.radius * 1.3);
  }

  function canStand(x, y) {
    return [[0, 0], [-6, 0], [6, 0], [0, -5], [0, 5]]
      .every(([dx, dy]) => isWalkable(x + dx, y + dy));
  }

  // Guide a mostly vertical input along the bend of the northern stairs.
  // This keeps an upward joystick push usable at the approach shown in game.
  function stairSteer(x, y, dx, dy) {
    if (y < 72 || y > 355 || Math.abs(dy) < Math.abs(dx) * .7) return dx;
    const stair = connectors.find(trail => trail.name === 'north stairs');
    const point = nearestPoint(x, y + dy, stair);
    if (point.distance > 120) return dx;
    const limit = Math.max(2, Math.abs(dy) * 1.1);
    return dx + Math.max(-limit, Math.min(limit, point.x - (x + dx))) * .7;
  }

  function move(x, y, dx, dy) {
    // Short substeps prevent a fast frame from jumping across a narrow path.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 9));
    let px = x, py = y;
    for (let i = 0; i < steps; i++) {
      const stepY = dy / steps;
      const stepX = stairSteer(px, py, dx / steps, stepY);
      const nx = px + stepX, ny = py + stepY;
      if (canStand(nx, ny)) { px = nx; py = ny; continue; }
      if (Math.abs(stepX) > .001 && canStand(nx, py)) { px = nx; continue; }
      if (Math.abs(stepY) > .001 && canStand(px, ny)) { py = ny; continue; }
      // At a corner, try a shallow tangent so input never freezes abruptly.
      const tangent = Math.max(3, Math.hypot(stepX, stepY) * .8);
      const candidates = [
        [px + tangent, py + stepY * .45], [px - tangent, py + stepY * .45],
        [px + stepX * .45, py + tangent], [px + stepX * .45, py - tangent],
        [px, py + tangent], [px, py - tangent]
      ].filter(([cx, cy]) => canStand(cx, cy));
      if (candidates.length) {
        candidates.sort((a, b) =>
          Math.hypot(a[0] - nx, a[1] - ny) - Math.hypot(b[0] - nx, b[1] - ny));
        // Do not move backwards against the requested direction.
        const [cx, cy] = candidates.find(([cx, cy]) =>
          (cx - px) * stepX + (cy - py) * stepY >= -0.1) || [];
        if (cx !== undefined) { px = cx; py = cy; }
      }
    }
    return { x: px, y: py };
  }

  return { width, height, isWalkable, canStand, move, clearing, connectors };
})();

if (typeof module !== 'undefined') module.exports = Terrain;
