const EliteWave = (() => {
  const respawnDelayMs = 5000;
  function scheduleIfCleared(enemies, now) {
    return enemies.every(enemy => enemy.hp === 0) ? now + respawnDelayMs : null;
  }
  function ready(deadline, now) {
    return deadline !== null && now >= deadline;
  }
  function secondsLeft(deadline, now) {
    return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
  }
  return { respawnDelayMs, scheduleIfCleared, ready, secondsLeft };
})();
if (typeof module !== 'undefined') module.exports = EliteWave;
