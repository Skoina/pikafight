const Story = (() => {
  const intro = [
    { speaker: '旁白', text: '今天是中秋節，汴河古鎮本該燈火通明、家家團圓，街上卻只剩三名商人守著空店。' },
    { speaker: '旁白', text: '黑犬道士趁佳節作亂，霸佔水源，又以迷魂香操縱遊俠貓，攪得鄉民不敢出門。' },
    { speaker: '小狗俠客', text: '中秋本是團圓的日子，怎能任他毀了家園？先向商人打聽線索，再去破他的妖法！' }
  ];
  const clues = {
    weapon: [
      { speaker: '鶴・武器商人', text: '今天是中秋節，遊俠貓本該護著返家團圓的鄉親。牠們從前替過路人擋刀，絕非天生惡徒。' },
      { speaker: '小狗俠客', text: '如今牠們卻攔路傷人，莫非中了邪術？' },
      { speaker: '鶴・武器商人', text: '正是。交手時護好自己，真正該斬斷的是控制牠們的妖法。' }
    ],
    armor: [
      { speaker: '熊・防具商人', text: '今天是中秋節，鎮外的水源卻被黑犬道士霸佔。沒有水，鄉親連團圓飯都難張羅，只得一戶戶離去。' },
      { speaker: '小狗俠客', text: '難怪街上空蕩。你們三個為何還留著？' },
      { speaker: '熊・防具商人', text: '總得有人守著家。若能打破他的法術、奪回水源，鄉親才有路回來。' }
    ],
    potion: [
      { speaker: '黑狗・藥水商人', text: '今天是中秋節，我卻聞到甜膩的迷魂香從城外廢寺飄來。遊俠貓聞了便像換了魂。' },
      { speaker: '小狗俠客', text: '廢寺裡，就是施法的邪惡道士？' },
      { speaker: '黑狗・藥水商人', text: '八九不離十。穿過右邊竹林，尋路去找他；路上可得留神。' }
    ]
  };
  const outro = [
    { speaker: '小狗俠客', text: '線索已齊。遊俠貓受迷魂香所困，水源也落在道士手裡。該從村莊右邊出發了！' }
  ];
  const clueIds = Object.keys(clues);
  const complete = seen => clueIds.every(id => seen.includes(id));
  return { intro, clues, outro, clueIds, complete };
})();
if (typeof module !== 'undefined') module.exports = Story;
