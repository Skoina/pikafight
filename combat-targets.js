const CombatTargets = (() => {
  const ranges = Object.freeze({ greatsword: 190, yitian: 225, imperial: 260 });
  const rangeForWeapon = weapon => ranges[weapon] || 150;

  function targetsForStrike(enemies, player, weapon) {
    const range = rangeForWeapon(weapon);
    const inRange = enemies.filter(enemy => enemy.hp > 0 &&
      Math.hypot(player.x - enemy.x, player.y - enemy.y) <= range);
    if (weapon === 'imperial') return inRange;
    const nearest = inRange.reduce((best, enemy) =>
      !best || Math.hypot(player.x - enemy.x, player.y - enemy.y) <
        Math.hypot(player.x - best.x, player.y - best.y) ? enemy : best, null);
    return nearest ? [nearest] : [];
  }

  return { rangeForWeapon, targetsForStrike };
})();
if (typeof module !== 'undefined') module.exports = CombatTargets;
