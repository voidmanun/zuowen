/* 档案、存储、导航、练功房与背诵验收。
   设计约束（见 docs/adr）：
   - 所有进度存 localStorage，一台电脑多个档案，无账号。
   - API Key 与档案分开存，导出档案时绝不带上 Key。
   - 背诵验收是离线的词语级拼接，没网也能走完核心循环。 */

const STORE_KEY = 'zwjm.v1';
const REVIEW_DAYS = 14;

let DB = null;          // { profiles: [], lastProfileId, settings }
let ME = null;          // 当前档案

/* ---------------- 存储 ---------------- */
function loadDB() {
  try { DB = JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch (e) { DB = null; }
  if (!DB || !Array.isArray(DB.profiles)) DB = { profiles: [], lastProfileId: null, settings: {} };
  return DB;
}
function saveDB() { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }

function newProfile(name, grade) {
  return {
    id: 'pf_' + Date.now().toString(36),
    name, grade: Number(grade),
    createdAt: Date.now(),
    skills: {},      // matId -> { learnedAt, lastReciteAt, usedCount }
    quests: {}       // questId -> { firstStars, cleared, tries }
  };
}

/* ---------------- 小工具 ---------------- */
const $  = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const mat = id => CORPUS.find(m => m.id === id);
const quest = id => QUESTS.find(q => q.id === id);
const genre = id => GENRES.find(g => g.id === id);
const days = ms => Math.floor(ms / 86400000);
const owned = () => Object.keys(ME.skills);

function allowedStars(grade) {
  if (grade === 4) return [1, 2];
  if (grade === 6) return [2, 3];
  return [1, 2, 3];
}

function view(name) {
  document.querySelectorAll('.view').forEach(v => v.hidden = true);
  $('view-' + name).hidden = false;
  window.scrollTo(0, 0);
}

function toast(msg, kind) {
  const d = document.createElement('div');
  d.className = 'notice ' + (kind || '');
  d.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:99;max-width:90vw;box-shadow:0 6px 20px rgba(0,0,0,.15);background:#fff';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3200);
}

/* ---------------- 档案页 ---------------- */
function renderProfiles() {
  const box = $('profileList');
  if (!DB.profiles.length) {
    box.innerHTML = '<p class="muted">还没有档案，下面新建一个。</p>';
  } else {
    box.innerHTML = DB.profiles.map(p => `
      <div class="card profile-card" data-pf="${p.id}">
        <div class="avatar">🧑‍🎓</div>
        <b>${esc(p.name)}</b>
        <div class="muted">${p.grade} 年级 · ${Object.keys(p.skills).length} 个技能</div>
      </div>`).join('');
    box.querySelectorAll('[data-pf]').forEach(el =>
      el.onclick = () => enter(el.dataset.pf));
  }
  view('profile');
}

function enter(id) {
  ME = DB.profiles.find(p => p.id === id);
  if (!ME) return renderProfiles();
  DB.lastProfileId = id; saveDB();
  $('whoami').textContent = `· ${ME.name}（${ME.grade}年级）`;
  renderHome();
}

/* ---------------- 大厅 ---------------- */
function renderHome() {
  const skills = owned();
  const usedCount = skills.filter(id => ME.skills[id].usedCount > 0).length;
  const cleared = Object.values(ME.quests).filter(q => q.cleared).length;
  const stars = Object.values(ME.quests).reduce((a, q) => a + (q.firstStars || 0), 0);

  $('homeHi').textContent = `${ME.name}，今天练哪一块？`;
  $('stSkills').textContent = skills.length;
  $('stStars').textContent = stars;
  $('stCleared').textContent = cleared;
  $('stUsed').textContent = usedCount;
  $('usedHint').textContent = skills.length
    ? `背下来的有 ${skills.length} 条，真正在挑战里用上过的有 ${usedCount} 条。背了不用，等于没背。`
    : '还没有技能。先去练功房背第一条。';

  renderReview();

  $('genreListLearn').innerHTML = GENRES.map(g => {
    const pool = CORPUS.filter(m => m.genre === g.id);
    const got = pool.filter(m => ME.skills[m.id]).length;
    return `<div class="card genre-card" data-genre="${g.id}">
      <div class="icon">${g.icon}</div>
      <b>${g.name}</b>
      <div class="muted">${g.desc}</div>
      <div class="muted">${got} / ${pool.length} 已掌握</div>
      <div class="bar"><i style="width:${Math.round(got / pool.length * 100)}%"></i></div>
    </div>`;
  }).join('');
  $('genreListLearn').querySelectorAll('[data-genre]').forEach(el =>
    el.onclick = () => renderLearn(el.dataset.genre));

  $('questList').innerHTML = QUESTS.map(q => {
    const rec = ME.quests[q.id];
    const g = genre(q.genre);
    const done = rec && rec.cleared;
    return `<div class="card genre-card" data-quest="${q.id}">
      <div class="icon">${q.monster.icon}</div>
      <b>《${esc(q.title)}》</b>
      <div class="muted">${g.name} · ${q.monster.name}</div>
      <div class="${done ? 'stars' : 'muted'}">${done ? starStr(rec.firstStars) : '未挑战'}</div>
    </div>`;
  }).join('');
  $('questList').querySelectorAll('[data-quest]').forEach(el =>
    el.onclick = () => startBattle(el.dataset.quest));

  view('home');
}

/* 复习推荐：只推荐，不降级、不锁定、不显示待办总数 */
function renderReview() {
  const now = Date.now();
  const stale = owned()
    .map(id => ({ id, s: ME.skills[id] }))
    .filter(x => x.s.usedCount === 0 && days(now - (x.s.lastReciteAt || x.s.learnedAt)) >= REVIEW_DAYS)
    .slice(0, 3);
  const box = $('reviewBlock');
  if (!stale.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="notice">
    <b>这几条有点久没碰了，顺手过一遍？</b>
    ${stale.map(x => `<div style="margin-top:6px">「${esc(mat(x.id).text)}」
      <button class="btn ghost small" data-re="${x.id}">再背一次</button></div>`).join('')}
  </div>`;
  box.querySelectorAll('[data-re]').forEach(el =>
    el.onclick = () => startRecite(el.dataset.re));
}

/* ---------------- 练功房 ---------------- */
let learnState = { genre: null, showAll: false };

function renderLearn(gid) {
  learnState.genre = gid;
  const g = genre(gid);
  const stars = allowedStars(ME.grade);
  const pool = CORPUS.filter(m => m.genre === gid &&
    (learnState.showAll || stars.includes(m.stars)));

  $('learnTitle').textContent = `${g.icon} ${g.name} · 练功房`;
  $('learnSub').innerHTML = `按 ${ME.grade} 年级默认只显示 ${stars.join('、')} 星素材。
    <button class="btn ghost small" id="toggleStars">${learnState.showAll ? '只看推荐星级' : '显示全部星级'}</button>`;

  $('learnList').innerHTML = pool.map(m => {
    const has = ME.skills[m.id];
    const slotNames = m.slotTypes.map(t => SLOT_TYPES[t].name).join('/');
    return `<div class="skill-item" ${has ? '' : `data-learn="${m.id}"`} style="${has ? 'opacity:.72' : ''}">
      <div>${esc(m.text)}</div>
      <div class="muted">
        <span class="stars">${starStr(m.stars)}</span>
        <span class="tag">${slotNames}</span>
        <span class="tag">${m.subjects.join(' ')}</span>
        <span class="tag">${m.grain}</span>
        ${has ? `<b style="color:var(--good)">✓ 已掌握</b>` : '<b style="color:var(--brand-dark)">点一下开始背</b>'}
      </div>
    </div>`;
  }).join('') || '<p class="muted">这个星级下没有素材，点上面切换全部星级。</p>';

  $('toggleStars').onclick = () => { learnState.showAll = !learnState.showAll; renderLearn(gid); };
  $('learnList').querySelectorAll('[data-learn]').forEach(el =>
    el.onclick = () => startRecite(el.dataset.learn));
  view('learn');
}

/* ---------------- 背诵验收：词语级拼接，全对才算背会 ---------------- */
let recite = null;   // { matId, segs, seg }

function startRecite(matId) {
  recite = { matId, segs: chunkSegments(matChunks(mat(matId))), seg: 0 };
  view('recite');
  reciteSeg();
}

function passRecite() {
  const id = recite.matId;
  const prev = ME.skills[id];
  ME.skills[id] = {
    learnedAt: prev ? prev.learnedAt : Date.now(),
    lastReciteAt: Date.now(),
    usedCount: prev ? prev.usedCount : 0
  };
  saveDB();
  const m = mat(id);
  const slotNames = m.slotTypes.map(t => SLOT_TYPES[t].name).join('/');
  $('reciteBox').innerHTML = `
    <div class="mx-celebrate">
      <div class="confetti" id="confetti"></div>
      <div class="mx-big-emoji mx-pop">🎉</div>
      <div class="mx-cheer mx-pop">太棒了！</div>
      <p class="muted">词语拼接全部点对，素材已收进口袋</p>
      <div class="reward-row">
        <div class="reward-chip"><div class="rc-icon">🧩</div><div>技能 +1</div></div>
        <div class="reward-chip"><div class="rc-icon">📖</div><div>技能库 ${owned().length} 条</div></div>
      </div>
      <div class="card" style="text-align:left">
        <div class="muted" style="font-size:.82rem">新技能入库</div>
        <div class="row" style="justify-content:space-between">
          <b>${slotNames} · ${m.grain}</b>
          <span class="tag" style="background:var(--mx-green-bg);color:var(--mx-green-text)">已入库</span>
        </div>
        <div style="margin-top:6px">${esc(m.text)}</div>
      </div>
      <div class="row" style="margin-top:14px">
        <button class="btn" id="nextOne">再背一条</button>
        <button class="btn ghost" id="backHome">回大厅</button>
      </div>
    </div>`;
  $('reciteStage').textContent = '';
  burstConfetti($('confetti'));
  $('nextOne').onclick = () => renderLearn(m.genre);
  $('backHome').onclick = renderHome;
}

/* 庆祝彩带：颜色用多邻国色板，纯 CSS 动画，动画结束后容器仍留着循环播放 */
function burstConfetti(box) {
  const colors = ['var(--mx-green)', 'var(--mx-blue)', 'var(--mx-yellow)', 'var(--mx-red)'];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('span');
    const size = 8 + (i % 3) * 4;
    s.style.cssText = `left:${(i * 137) % 100}%;width:${size}px;height:${size * (i % 2 ? 1 : 1.6)}px;` +
      `background:${colors[i % 4]};border-radius:${i % 3 ? '50%' : '2px'};` +
      `animation:mxConf ${2.3 + (i % 5) * .35}s linear ${(i % 9) * .12}s infinite;`;
    box.appendChild(s);
  }
}

/* ===== 背诵验收主体：词语级拼接 ===== */

/* 自动分词只作兑底：Intl.Segmenter 实测会切出「人的脚/后跟」「他二话/没说」这类
   跨词块，读起来节奏是断的，会干扰记忆；主力是 corpus.js 里的人工标注词块。 */
function autoChunks(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter('zh', { granularity: 'word' });
    return Array.from(seg.segment(text), s => s.segment);
  }
  return text.split(/(?<=[，。！？；：、…])/).filter(Boolean);
}

/* 人工词块优先，自检：join 后与原文完全一致才采用；
   标注写错就自动回退自动分词，不让背诵功能崩。 */
function matChunks(m) {
  if (Array.isArray(m.chunks) && m.chunks.join('') === m.text) return m.chunks;
  return autoChunks(m.text);
}

/* 词块超过 9 个自动分段（9 块 + 余数），每段都过才算背会入库 */
function chunkSegments(chunks) {
  if (chunks.length <= 9) return [chunks];
  const segs = [];
  for (let i = 0; i < chunks.length; i += 9) segs.push(chunks.slice(i, i + 9));
  return segs;
}

function reciteSeg() {
  const m = mat(recite.matId);
  const chunks = recite.segs[recite.seg];
  const total = recite.segs.reduce((a, s) => a + s.length, 0);
  const doneAll = recite.segs.slice(0, recite.seg).reduce((a, s) => a + s.length, 0);
  const multi = recite.segs.length > 1;
  $('reciteStage').textContent = multi
    ? `词块多，自动分成 ${recite.segs.length} 段：现在是第 ${recite.seg + 1} 段`
    : `共 ${chunks.length} 块，按顺序点回这条素材`;
  const shuffled = chunks.map((t, i) => ({ t, i })).sort(() => Math.random() - 0.5);
  $('reciteBox').innerHTML = `
    <div class="mx-progress"><i id="progFill"></i></div>
    <div class="mat-text big" id="fullText">${esc(m.text)}</div>
    <div class="row"><button class="btn ghost small" id="hideText">🙈 盖住原文，凭记忆拼</button></div>
    <h2>按顺序点下面的词块，把原句拼回来</h2>
    <div class="drop-zone" id="zone"></div>
    <div id="bank" class="frag-bank">
      ${shuffled.map(f => `<span class="frag" data-i="${f.i}">${esc(f.t)}</span>`).join('')}
    </div>`;
  let next = 0;
  const setProg = () => {
    $('progFill').style.width = Math.round((doneAll + next) / total * 100) + '%';
  };
  setProg();
  $('hideText').onclick = () => {
    const hide = !$('fullText').classList.contains('covered');
    $('fullText').classList.toggle('covered', hide);
    $('hideText').textContent = hide ? '👀 看一眼原文' : '🙈 盖住原文，凭记忆拼';
  };
  $('bank').querySelectorAll('.frag').forEach(el => el.onclick = () => {
    if (Number(el.dataset.i) !== next) {
      el.classList.add('miss');
      setTimeout(() => el.classList.remove('miss'), 340);
      toast('这一块不是这个位置，再想想 🤔', 'bad');
      return;
    }
    el.classList.add('used');
    const placed = document.createElement('span');
    placed.className = 'frag put mx-pop';
    placed.textContent = el.textContent;      // 用 DOM 构造，不把文本再当 HTML 解析一次
    $('zone').appendChild(placed);
    next++;
    setProg();
    if (next < chunks.length) return;
    if (recite.seg + 1 < recite.segs.length) {
      toast(`第 ${recite.seg + 1} 段全对！接着背下一段`, 'good');
      recite.seg++;
      setTimeout(reciteSeg, 700);
    } else {
      toast('词块全部按顺序点对了！', 'good');
      setTimeout(passRecite, 700);
    }
  });
}

/* ---------------- 设置 ---------------- */
function renderSettings() {
  $('setGrade').value = String(ME ? ME.grade : 4);
  $('setProfileInfo').textContent = ME
    ? `${ME.name}：${owned().length} 个技能，${Object.values(ME.quests).filter(q => q.cleared).length} 只怪兽已倒下。`
    : '还没选档案。';
  view('settings');
}

function bindSettings() {
  $('testConn').onclick = runSelfTest;
  $('saveGrade').onclick = () => {
    ME.grade = Number($('setGrade').value); saveDB();
    $('whoami').textContent = `· ${ME.name}（${ME.grade}年级）`;
    toast('年级已保存', 'good');
  };
  $('exportOne').onclick = () => download(`作文积木-${ME.name}.json`, JSON.stringify({ profiles: [ME] }, null, 2));
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

/* ---------------- 启动 ---------------- */
function boot() {
  loadDB();
  bindSettings();
  bindBattle();          // battle.js

  $('createProfile').onclick = () => {
    const name = $('newName').value.trim();
    if (!name) return toast('先写个名字', 'bad');
    const p = newProfile(name, $('newGrade').value);
    DB.profiles.push(p); saveDB(); enter(p.id);
  };
  $('exportAll').onclick = () => download('作文积木-全部档案.json', JSON.stringify({ profiles: DB.profiles }, null, 2));
  $('importFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d.profiles) throw new Error('文件里没有 profiles');
        d.profiles.forEach(p => {
          const hit = DB.profiles.findIndex(x => x.id === p.id);
          hit >= 0 ? DB.profiles[hit] = p : DB.profiles.push(p);
        });
        saveDB(); renderProfiles(); toast('导入成功', 'good');
      } catch (err) { toast('导入失败：' + err.message, 'bad'); }
    };
    r.readAsText(f);
  };

  $('navHome').onclick = () => ME ? renderHome() : renderProfiles();
  $('navSettings').onclick = renderSettings;
  $('navSwitch').onclick = renderProfiles;
  document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => ME ? renderHome() : renderProfiles());

  const last = DB.profiles.find(p => p.id === DB.lastProfileId);
  last ? enter(last.id) : renderProfiles();
}
document.addEventListener('DOMContentLoaded', boot);
