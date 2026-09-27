const Shops = (() => {
  const items = Object.freeze({
    greatsword: { name: '鋼鐵巨劍', merchant: 'weapon', price: 500, attack: 8, icon: 0 },
    yitian: { name: '倚天劍', merchant: 'weapon', price: 700, attack: 16, icon: 1 },
    imperial: { name: '尚方寶劍', merchant: 'weapon', price: 1000, attack: 35, icon: 2 },
    cloth: { name: '布甲', merchant: 'armor', price: 300, defense: 5, icon: 3 },
    iron: { name: '鐵甲', merchant: 'armor', price: 500, defense: 10, icon: 4 },
    chainmail: { name: '鋼鐵鎖子甲', merchant: 'armor', price: 1000, defense: 30, icon: 5 },
    potion: { name: '紅色藥水', merchant: 'potion', price: 30, healing: 10, icon: 6 }
  });
  const merchants = Object.freeze({
    weapon: { name: '鶴・武器商人', x: 360, y: 386, sprite: 0 },
    armor: { name: '熊・防具商人', x: 785, y: 386, sprite: 1 },
    potion: { name: '黑狗・藥水商人', x: 1115, y: 386, sprite: 2 }
  });

  function cleanInventory(raw) {
    const owned = Array.isArray(raw?.owned) ? raw.owned.filter(id => items[id] && id !== 'potion') : [];
    const unique = [...new Set(owned)];
    return {
      owned: unique,
      weapon: unique.includes(raw?.weapon) && items[raw.weapon].merchant === 'weapon' ? raw.weapon : null,
      armor: unique.includes(raw?.armor) && items[raw.armor].merchant === 'armor' ? raw.armor : null,
      potions: Number.isFinite(raw?.potions) ? Math.max(0, Math.floor(raw.potions)) : 0
    };
  }

  function bonuses(inventory) {
    return {
      attack: items[inventory.weapon]?.attack || 0,
      defense: items[inventory.armor]?.defense || 0
    };
  }

  function buy(id, gold, inventory) {
    const item = items[id];
    if (!item) return { ok: false, reason: '沒有這件商品' };
    if (id !== 'potion' && inventory.owned.includes(id)) {
      return { ok: true, gold, inventory: { ...inventory, [item.merchant]: id }, equipped: true };
    }
    if (gold < item.price) return { ok: false, reason: '金幣不足' };
    const next = { ...inventory, owned: [...inventory.owned] };
    if (id === 'potion') next.potions++;
    else { next.owned.push(id); next[item.merchant] = id; }
    return { ok: true, gold: gold - item.price, inventory: next, equipped: false };
  }

  function autoHeal(hp, maxHp, inventory) {
    let healed = 0;
    while (inventory.potions > 0 && hp < maxHp * .8) {
      const amount = Math.min(10, maxHp - hp);
      hp += amount; healed += amount; inventory.potions--;
    }
    return { hp, healed, inventory };
  }

  return { items, merchants, cleanInventory, bonuses, buy, autoHeal };
})();
if (typeof module !== 'undefined') module.exports = Shops;
