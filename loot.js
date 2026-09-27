const Loot = (() => {
  function eliteDrops(x, y, goldAmount = 100) {
    return [
      { map: 'river', kind: 'gold', x: x - 24, y: y + 24, amount: goldAmount, age: 0 },
      { map: 'river', kind: 'potion', x: x + 24, y: y + 24, amount: 1, age: 0 }
    ];
  }
  function collect(item, player, inventory) {
    if (item.collected) return false;
    if (item.kind === 'potion') inventory.potions += item.amount;
    else player.gold += item.amount;
    item.collected = true;
    return true;
  }
  return { eliteDrops, collect };
})();
if (typeof module !== 'undefined') module.exports = Loot;
