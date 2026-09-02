/* 题材、题目与骨架定义。
   术语见 ./CONTEXT.md：题材 > 题目 > 骨架 > 槽位。
   槽位的 type 必须出现在素材的 slotTypes 里才算契合；
   expectSubjects 为空表示不挑对象，素材 subjects 含「通用」视为万能匹配。 */

const SLOT_TYPES = {
  opening:     { name: '开头点题', hint: '一句话把题目点出来，让人知道你要写谁/写什么' },
  appearance:  { name: '外貌特写', hint: '抓一两处最有特点的样子，别从头写到脚' },
  personality: { name: '性格事例', hint: '用一件具体的事证明他的性格，不能只说「他很好」' },
  action:      { name: '细节动作', hint: '把一个动作放慢镜头，写清手、眼睛、身体怎么动' },
  panorama:    { name: '整体远景', hint: '先站远一点，写出这个地方的整体样子' },
  closeup:     { name: '局部特写', hint: '再走近一点，只写一样东西，写细' },
  dynamic:     { name: '动态声响', hint: '加入会动的、会响的，让景活起来' },
  process:     { name: '事情经过', hint: '按顺序讲清事情怎么发展的' },
  inner:       { name: '心理活动', hint: '写当时心里在想什么、怕什么、盼什么' },
  climax:      { name: '高潮细节', hint: '最紧张或最关键的那一下，要写慢、写细' },
  shape:       { name: '外形描写', hint: '写它的形状、颜色、大小，让人能画出来' },
  feature:     { name: '细节特点', hint: '写别人不容易注意到的一处细节' },
  usage:       { name: '用途趣事', hint: '写它有什么用，或和它有关的一件小事' },
  ending:      { name: '结尾抒情', hint: '收住，写出你的心情或想法，别硬喊口号' }
};

const GENRES = [
  { id: 'renwu',    name: '写人', icon: '🧑', desc: '把一个人写活' },
  { id: 'xiejing',  name: '写景', icon: '🌳', desc: '把一处景写美' },
  { id: 'xushi',    name: '叙事', icon: '📖', desc: '把一件事写清' },
  { id: 'zhuangwu', name: '状物', icon: '🧸', desc: '把一样东西写细' }
];

const QUESTS = [
  /* ---------------- 写人 ---------------- */
  {
    id: 'q_renwu_1', genre: 'renwu', title: '我的同桌',
    brief: '你的同桌是个男生，个子不高，爱打篮球，做题特别快。',
    monster: { name: '词穷小怪', icon: '👾' },
    slots: [
      { type: 'opening',     expectSubjects: ['同学', '男生'] },
      { type: 'appearance',  expectSubjects: ['男生', '同学'] },
      { type: 'personality', expectSubjects: ['同学', '男生'] },
      { type: 'action',      expectSubjects: ['同学', '男生'] },
      { type: 'ending',      expectSubjects: ['同学', '男生'] }
    ]
  },
  {
    id: 'q_renwu_2', genre: 'renwu', title: '我最敬佩的老师',
    brief: '语文老师，四十岁左右，讲课声音好听，改作业很认真。',
    monster: { name: '空话怪', icon: '🗯️' },
    slots: [
      { type: 'opening',     expectSubjects: ['老师'] },
      { type: 'appearance',  expectSubjects: ['老师'] },
      { type: 'personality', expectSubjects: ['老师'] },
      { type: 'action',      expectSubjects: ['老师'] },
      { type: 'ending',      expectSubjects: ['老师'] }
    ]
  },
  {
    id: 'q_renwu_3', genre: 'renwu', title: '我的妈妈',
    brief: '妈妈下班很晚，手上有做家务留下的痕迹，脾气有点急但很疼你。',
    monster: { name: '流水账兽', icon: '🐗' },
    slots: [
      { type: 'opening',     expectSubjects: ['妈妈'] },
      { type: 'appearance',  expectSubjects: ['妈妈'] },
      { type: 'personality', expectSubjects: ['妈妈'] },
      { type: 'action',      expectSubjects: ['妈妈'] },
      { type: 'ending',      expectSubjects: ['妈妈'] }
    ]
  },

  /* ---------------- 写景 ---------------- */
  {
    id: 'q_xiejing_1', genre: 'xiejing', title: '校园的秋天',
    brief: '十月的校园，操场边的梧桐叶黄了，风一吹就落。',
    monster: { name: '干巴巴怪', icon: '🪵' },
    slots: [
      { type: 'opening',   expectSubjects: ['秋', '校园'] },
      { type: 'panorama',  expectSubjects: ['秋', '校园'] },
      { type: 'closeup',   expectSubjects: ['秋', '校园'] },
      { type: 'dynamic',   expectSubjects: ['秋', '校园'] },
      { type: 'ending',    expectSubjects: ['秋', '校园'] }
    ]
  },
  {
    id: 'q_xiejing_2', genre: 'xiejing', title: '雨后的公园',
    brief: '一场夏雨刚停，公园里到处是水珠，空气很凉。',
    monster: { name: '朦胧怪', icon: '🌫️' },
    slots: [
      { type: 'opening',   expectSubjects: ['雨', '公园'] },
      { type: 'panorama',  expectSubjects: ['雨', '公园'] },
      { type: 'closeup',   expectSubjects: ['雨', '公园'] },
      { type: 'dynamic',   expectSubjects: ['雨', '公园'] },
      { type: 'ending',    expectSubjects: ['雨', '公园'] }
    ]
  },
  {
    id: 'q_xiejing_3', genre: 'xiejing', title: '家乡的小河',
    brief: '村口那条小河，水不深，能看见石头，夏天有人在旁边洗衣服。',
    monster: { name: '空洞兽', icon: '🕳️' },
    slots: [
      { type: 'opening',   expectSubjects: ['水', '家乡'] },
      { type: 'panorama',  expectSubjects: ['水', '家乡'] },
      { type: 'closeup',   expectSubjects: ['水', '家乡'] },
      { type: 'dynamic',   expectSubjects: ['水', '家乡'] },
      { type: 'ending',    expectSubjects: ['水', '家乡'] }
    ]
  },

  /* ---------------- 叙事 ---------------- */
  {
    id: 'q_xushi_1', genre: 'xushi', title: '一次难忘的运动会',
    brief: '你参加 400 米接力，是第三棒，交接棒的时候差点掉了。',
    monster: { name: '平淡怪', icon: '😐' },
    slots: [
      { type: 'opening', expectSubjects: ['运动会', '比赛'] },
      { type: 'process', expectSubjects: ['运动会', '比赛'] },
      { type: 'inner',   expectSubjects: ['运动会', '比赛'] },
      { type: 'climax',  expectSubjects: ['运动会', '比赛'] },
      { type: 'ending',  expectSubjects: ['运动会', '比赛'] }
    ]
  },
  {
    id: 'q_xushi_2', genre: 'xushi', title: '那次我做错了',
    brief: '你打碎了同学的水杯，一开始没敢承认，后来主动去说了。',
    monster: { name: '心虚怪', icon: '😰' },
    slots: [
      { type: 'opening', expectSubjects: ['犯错', '反思'] },
      { type: 'process', expectSubjects: ['犯错', '反思'] },
      { type: 'inner',   expectSubjects: ['犯错', '反思'] },
      { type: 'climax',  expectSubjects: ['犯错', '反思'] },
      { type: 'ending',  expectSubjects: ['犯错', '反思'] }
    ]
  },
  {
    id: 'q_xushi_3', genre: 'xushi', title: '第一次做饭',
    brief: '你第一次学着炒鸡蛋，油溅出来吓了一跳，最后端上桌了。',
    monster: { name: '手忙脚乱兽', icon: '🍳' },
    slots: [
      { type: 'opening', expectSubjects: ['第一次', '家务'] },
      { type: 'process', expectSubjects: ['第一次', '家务'] },
      { type: 'inner',   expectSubjects: ['第一次', '家务'] },
      { type: 'climax',  expectSubjects: ['第一次', '家务'] },
      { type: 'ending',  expectSubjects: ['第一次', '家务'] }
    ]
  },

  /* ---------------- 状物 ---------------- */
  {
    id: 'q_zhuangwu_1', genre: 'zhuangwu', title: '我的文具盒',
    brief: '用了两年的文具盒，蓝色，边角磕掉了漆，里面塞得很满。',
    monster: { name: '说明书怪', icon: '📋' },
    slots: [
      { type: 'opening', expectSubjects: ['文具', '物品'] },
      { type: 'shape',   expectSubjects: ['文具', '物品'] },
      { type: 'feature', expectSubjects: ['文具', '物品'] },
      { type: 'usage',   expectSubjects: ['文具', '物品'] },
      { type: 'ending',  expectSubjects: ['文具', '物品'] }
    ]
  },
  {
    id: 'q_zhuangwu_2', genre: 'zhuangwu', title: '窗台上的绿萝',
    brief: '养在窗台的一盆绿萝，叶子垂下来，长得很快。',
    monster: { name: '干枯怪', icon: '🥀' },
    slots: [
      { type: 'opening', expectSubjects: ['植物'] },
      { type: 'shape',   expectSubjects: ['植物'] },
      { type: 'feature', expectSubjects: ['植物'] },
      { type: 'usage',   expectSubjects: ['植物'] },
      { type: 'ending',  expectSubjects: ['植物'] }
    ]
  },
  {
    id: 'q_zhuangwu_3', genre: 'zhuangwu', title: '我家的小狗',
    brief: '一只黄色的小土狗，叫豆豆，最爱在门口等你回家。',
    monster: { name: '呆板兽', icon: '🪨' },
    slots: [
      { type: 'opening', expectSubjects: ['动物'] },
      { type: 'shape',   expectSubjects: ['动物'] },
      { type: 'feature', expectSubjects: ['动物'] },
      { type: 'usage',   expectSubjects: ['动物'] },
      { type: 'ending',  expectSubjects: ['动物'] }
    ]
  }
];

/* 浏览器里 module 不存在，这行自动跳过；Node（server.js）靠它拿到同一份题目与骨架。 */
if (typeof module !== 'undefined') module.exports = { SLOT_TYPES, GENRES, QUESTS };
