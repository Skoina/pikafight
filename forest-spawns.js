const ForestSpawns = (() => {
  const portals = [[878, 160], [1201, 758]];
  function valid(x, y, ground, player, others) {
    return ground.canStand(x, y) &&
      Math.hypot(x - player.x, y - player.y) >= 210 &&
      portals.every(([px, py]) => Math.hypot(x - px, y - py) >= 125) &&
      others.every(other => Math.hypot(x - other.x, y - other.y) >= 180);
  }
  function pick(ground, player, others = [], random = Math.random) {
    for (let attempt = 0; attempt < 600; attempt++) {
      const x = 40 + random() * (ground.width - 80);
      const y = 35 + random() * (ground.height - 280);
      if (valid(x, y, ground, player, others)) return { x, y };
    }
    // Narrow passages can make repeated random misses likely; still select a
    // random point from the complete set of eligible ground cells.
    const choices = [];
    for (let y = 45; y < ground.height - 90; y += 24)
      for (let x = 48; x < ground.width - 48; x += 24)
        if (valid(x, y, ground, player, others)) choices.push({ x, y });
    if (!choices.length) throw new Error('No eligible forest cat spawn');
    return choices[Math.floor(random() * choices.length)];
  }
  return { pick, valid };
})();
if (typeof module !== 'undefined') module.exports = ForestSpawns;
