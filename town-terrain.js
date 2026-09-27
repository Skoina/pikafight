// Walkable stone street and the open space in front of the three stalls.
const TownTerrain = (() => {
  const width = 1536;
  const height = 1024;
  function isWalkable(x, y) {
    if (x < 18 || x > 1518) return false;
    // The street spans the painting; the merchant forecourts open northward.
    if (y >= 384 && y <= 535) return true;
    if (y >= 333 && y < 384 && x >= 205 && x <= 1250) return true;
    // Rightmost paving links the street to the portal dais.
    if (x >= 1295 && y >= 350 && y <= 520) return true;
    return false;
  }
  function canStand(x, y) {
    return [[0, 0], [-8, 0], [8, 0], [0, -6], [0, 6]]
      .every(([dx, dy]) => isWalkable(x + dx, y + dy));
  }
  return { width, height, isWalkable, canStand };
})();
if (typeof module !== 'undefined') module.exports = TownTerrain;
