const Progression = (() => {
  const levelThresholds = [0, 100, 250, 450, 700, 950, 1200, 1450, 1700, 2000];
  const maxLevel = 10;
  const playerAttackSpeed = 1.3;
  const cat = Object.freeze({ maxHp: 45, attack: 18, defense: 10, attackSpeed: 1,
    experience: 25, gold: 40, goldVariation: 5 });
  const eliteCat = Object.freeze({ maxHp: 100, attack: 30, defense: 20, attackSpeed: 1.5,
    experience: 60, gold: 100, goldVariation: 10 });

  function statsForLevel(level) {
    const safeLevel = Math.max(1, Math.min(maxLevel, Math.floor(level)));
    const ordinaryLevels = Math.min(safeLevel - 1, 8);
    const finalBonus = safeLevel === 10 ? 20 : 0;
    return {
      maxHp: 200 + (safeLevel - 1) * 10,
      attack: 15 + ordinaryLevels * 4 + finalBonus,
      defense: 15 + ordinaryLevels * 3 + finalBonus
    };
  }

  function levelForExperience(experience) {
    let level = 1;
    for (let i = 1; i < levelThresholds.length; i++) {
      if (experience >= levelThresholds[i]) level = i + 1;
    }
    return level;
  }

  function nextThreshold(level) {
    return level >= maxLevel ? null : levelThresholds[level];
  }

  function damage(attack, defense) {
    return Math.max(1, attack - defense);
  }

  function rolledDamage(attack, defense, random = Math.random) {
    const swing = Math.min(10, Math.floor(random() * 11)) - 5;
    return Math.max(1, damage(attack, defense) + swing);
  }

  function attackTiming(enemy) {
    return {
      windup: .36 / enemy.attackSpeed,
      duration: .68 / enemy.attackSpeed,
      cooldown: .72 / enemy.attackSpeed
    };
  }

  function attackPose(enemy, action) {
    if (!action.active) return 0;
    return action.elapsed < attackTiming(enemy).windup ? 1 : 2;
  }

  function grantExperience(experience, amount) {
    const before = levelForExperience(experience);
    const afterExperience = Math.min(levelThresholds[maxLevel - 1], experience + amount);
    const after = levelForExperience(afterExperience);
    return { experience: afterExperience, level: after, levelsGained: after - before };
  }

  function goldDrop(enemy, random = Math.random) {
    return enemy.gold - enemy.goldVariation +
      Math.floor(random() * (enemy.goldVariation * 2 + 1));
  }

  function migrateExperience(experience) {
    const oldThresholds = [0, 10, 20, 40, 60];
    const oldExperience = Math.max(0, Math.min(60, Math.floor(experience)));
    let level = 1;
    while (level < oldThresholds.length && oldExperience >= oldThresholds[level]) level++;
    if (level === oldThresholds.length) return levelThresholds[oldThresholds.length - 1];
    const progress = (oldExperience - oldThresholds[level - 1]) /
      (oldThresholds[level] - oldThresholds[level - 1]);
    return Math.round(levelThresholds[level - 1] + progress *
      (levelThresholds[level] - levelThresholds[level - 1]));
  }

  return { levelThresholds, maxLevel, playerAttackSpeed, cat, eliteCat,
    statsForLevel, levelForExperience,
    nextThreshold, damage, rolledDamage, attackTiming, attackPose, grantExperience,
    goldDrop, migrateExperience };
})();

if (typeof module !== 'undefined') module.exports = Progression;
