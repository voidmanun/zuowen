/* 挑战：拼搭、规则判定、AI 增强点评、连通性自检。
   判定的唯一权威是本地规则（见 docs/adr/0002）；AI 只负责把规则的结论讲得更像人话。
   AI 不可用时，除了少一段点评，其它一切照常。 */

const BASE_DMG   = 20;      // 单槽基准伤害（1 星）
const STAR_STEP  = 5;       // 每多一星 +5
const FRESH_BONUS = 5;      // 新技能首次施放奖励：用正激励代替「复用惩罚」
const HP_FACTOR  = 0.8;     // 怪兽血量 = 满额伤害 × 0.8，允许错一两处

let battle = null;   // { questId, fills: {slotIndex: matId}, activeSlot, judged }

function slotFullDamage(stars) { return BASE_DMG + STAR_STEP * (stars - 1); }

/* ---------------- 规则判定 ---------------- */
function subjectOk(m, slot) {
  if (!slot.expectSubjects || !slot.expectSubjects.length) return true;
  if (m.subjects.includes('通用')) return true;
  return m.subjects.some(s => slot.expectSubjects.includes(s));
}

function judgeOne(m, slot) {
  if (!m.slotTypes.includes(slot.type)) {
    return { fit: 0, level: 'none',
      why: `这条是「${m.slotTypes.map(t => SLOT_TYPES[t].name).join('/')}」用的，放进「${SLOT_TYPES[slot.type].name}」不对位。` };
  }
  if (!subjectOk(m, slot)) {
    return { fit: 0.5, level: 'half',
      why: `位置对了，但它写的是「${m.subjects.join('、')}」，这道题要写的是「${slot.expectSubjects.join('、')}」，得改一改才贴。` };
  }
  return { fit: 1, level: 'full', why: '位置对，对象也对，正中要害。' };
}

function maxHp(q) {
  return Math.round(q.slots.length * BASE_DMG * HP_FACTOR);
}

/* ---------------- 进入挑战 ---------------- */
function startBattle(questId) {
  const q = quest(questId);
  battle = { questId, fills: {}, activeSlot: null, judged: false };
  $('battleTitle').textContent = `《${q.title}》`;
  $('battleBrief').textContent = q.brief;
  $('mFace').textContent = q.monster.icon;
  $('mName').textContent = q.monster.name;
  $('hpMax').textContent = maxHp(q);
  setHp(maxHp(q), maxHp(q));
  $('pickerBox').hidden = true;
  renderSlots();
  view('battle');
}

function setHp(now, max) {
  $('hpNow').textContent = Math.max(0, now);
  $('hpFill').style.width = Math.max(0, now / max * 100) + '%';
}

function renderSlots() {
  const q = quest(battle.questId);
  $('slotList').innerHTML = q.slots.map((s, i) => {
    const st = SLOT_TYPES[s.type];
    const filledId = battle.fills[i];
    const m = filledId ? mat(filledId) : null;
    let cls = 'slot' + (m ? ' filled' : '') + (battle.activeSlot === i ? ' active' : '');
    let verdict = '';
    if (battle.judged && m) {
      const j = judgeOne(m, s);
      cls += ' fit-' + j.level;
      verdict = `<div class="verdict ${j.level}">${j.level === 'full' ? '✅' : j.level === 'half' ? '⚠️' : '❌'} ${esc(j.why)}</div>`;
    }
    return `<div class="${cls}" data-slot="${i}">
      <div class="slot-head"><span>${i + 1}. ${st.name}</span>
        ${s.expectSubjects.length ? `<span class="tag">要写：${s.expectSubjects.join('/')}</span>` : ''}
        ${m ? '<span class="tag">已填</span>' : ''}</div>
      <div class="slot-hint">${st.hint}</div>
      <div class="slot-fill">${m ? esc(m.text) : '<span class="muted">（空着，点一下选技能）</span>'}</div>
      ${verdict}
    </div>`;
  }).join('');
  $('slotList').querySelectorAll('[data-slot]').forEach(el =>
    el.onclick = () => openPicker(Number(el.dataset.slot)));
  const n = Object.keys(battle.fills).length;
  $('fillCount').textContent = `已填 ${n} / ${q.slots.length} 个槽位`;
  $('submitBtn').disabled = n === 0;
}

/* ---------------- 选技能：只能从技能库里取 ---------------- */
function hidePicker() {
  $('pickerBox').hidden = true;
  $('pickerMask').hidden = true;
  battle.activeSlot = null;
}

function openPicker(slotIndex) {
  battle.activeSlot = slotIndex;
  const q = quest(battle.questId);
  const slot = q.slots[slotIndex];
  const st = SLOT_TYPES[slot.type];
  const used = new Set(Object.entries(battle.fills).filter(([k]) => Number(k) !== slotIndex).map(([, v]) => v));

  $('pickerTitle').textContent = `给「${st.name}」挑一条技能`;
  $('pickerHint').textContent = st.hint + '（只显示你已经背下来的，同一条技能一篇里不能用两次）';

  const mine = owned().filter(id => !used.has(id)).map(mat);
  if (!mine.length) {
    $('pickerList').innerHTML = '<p class="muted">技能库还是空的。先去练功房背几条，回来才有货可用。</p>';
  } else {
    // 同题材优先，其次通用，其余靠后——不隐藏任何技能，让孩子自己判断
    const rank = m => (m.genre === q.genre ? 0 : 1);
    mine.sort((a, b) => rank(a) - rank(b) || b.stars - a.stars);
    $('pickerList').innerHTML = mine.map(m => {
      const fresh = ME.skills[m.id].usedCount === 0;
      return `<button class="skill-item ${fresh ? 'fresh' : ''}" data-pick="${m.id}">
        <div>${esc(m.text)}</div>
        <div class="muted"><span class="stars">${starStr(m.stars)}</span>
          <span class="tag">${m.slotTypes.map(t => SLOT_TYPES[t].name).join('/')}</span>
          <span class="tag">${m.subjects.join(' ')}</span>
          ${fresh ? '<b style="color:var(--good)">首次施放 +5</b>' : ''}</div>
      </button>`;
    }).join('');
    $('pickerList').querySelectorAll('[data-pick]').forEach(el => el.onclick = () => {
      battle.fills[slotIndex] = el.dataset.pick;
      battle.judged = false;
      sfx.pick();
      hidePicker();
      renderSlots();
    });
  }
  $('pickerBox').hidden = false;
  $('pickerMask').hidden = false;
  sfx.sheet();
  renderSlots();
}

async function submitBattle() {
  const q = quest(battle.questId);
  const hp = maxHp(q);
  let dmg = 0;
  const detail = [];

  q.slots.forEach((s, i) => {
    const id = battle.fills[i];
    if (!id) { detail.push({ i, empty: true }); return; }
    const m = mat(id);
    const j = judgeOne(m, s);
    const fresh = ME.skills[id].usedCount === 0;
    const d = Math.round(j.fit * slotFullDamage(m.stars) + (j.fit > 0 && fresh ? FRESH_BONUS : 0));
    dmg += d;
    detail.push({ i, m, j, d, fresh });
  });

  battle.judged = true;
  renderSlots();
  setHp(Math.max(0, hp - dmg), hp);
  flashDamage(dmg);
  shakeFace();
  sfx.hit();

  const cleared = dmg >= hp;
  const misuse = detail.filter(x => x.m && x.j.fit < 1);
  const rec = ME.quests[q.id] || { tries: 0, cleared: false, firstStars: 0 };
  rec.tries++;
  if (rec.tries === 1) rec.firstStars = cleared ? (misuse.length ? 2 : 3) : 1;   // 首投才计星
  if (cleared) rec.cleared = true;
  ME.quests[q.id] = rec;
  // 只有真正被用上的技能才累加使用次数——这就是「背了到底用没用」的护城河数据
  detail.forEach(x => { if (x.m) ME.skills[x.m.id].usedCount++; });
  saveDB();

  showResult(q, { dmg, hp, cleared, detail, misuse, rec });
  enrichWithAi(q, detail);
}

/* 怪兽被打中：抖一下。remove + 读 offsetWidth 强制回流，重复提交也能重播动画 */
function shakeFace() {
  const f = $('mFace');
  f.classList.remove('mx-shake');
  void f.offsetWidth;
  f.classList.add('mx-shake');
  setTimeout(() => f.classList.remove('mx-shake'), 420);
}

function flashDamage(dmg) {
  const d = document.createElement('div');
  d.className = 'dmg-float';
  d.textContent = '-' + dmg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1100);
}

/* 漏用：技能库里对这道题「完全契合」、却没被用上的技能 */
function findMissed(q) {
  const usedIds = new Set(Object.values(battle.fills));
  const out = [];
  q.slots.forEach((s, i) => {
    owned().forEach(id => {
      if (usedIds.has(id)) return;
      const m = mat(id);
      if (judgeOne(m, s).fit === 1) out.push({ slot: i, m });
    });
  });
  const seen = new Set();
  return out.filter(x => !seen.has(x.m.id) && seen.add(x.m.id)).slice(0, 5);
}

function showResult(q, r) {
  const missed = findMissed(q);
  if (r.cleared) { burstConfetti($('resConfetti')); sfx.win(); }   // 通关彩带+号角，同庆祝页（app.js）
  else sfx.lose();
  $('resTitle').textContent = r.cleared
    ? `🎉 ${q.monster.name} 被打倒了！`
    : `${q.monster.icon} ${q.monster.name} 还剩 ${r.hp - r.dmg} 点血`;
  $('resStars').textContent = starStr(r.rec.firstStars);
  $('resSummary').textContent = r.cleared
    ? `本次造成 ${r.dmg} 点伤害（需要 ${r.hp}）。星级按第一次提交计算，已记为 ${r.rec.firstStars} 星；接着调整重打不会降星。`
    : `本次造成 ${r.dmg} 点伤害，还差 ${r.hp - r.dmg}。换几条更贴题的技能再来，随时可以重打。`;

  const rows = r.detail.map(x => {
    const st = SLOT_TYPES[q.slots[x.i].type];
    if (x.empty) return `<div class="miss-item"><b>${x.i + 1}. ${st.name}</b>：空着没填，这一段的伤害全丢了。</div>`;
    const icon = x.j.level === 'full' ? '✅' : x.j.level === 'half' ? '⚠️' : '❌';
    return `<div class="miss-item"><b>${x.i + 1}. ${st.name}</b> ${icon} −${x.d}${x.fresh && x.j.fit > 0 ? '（含首次施放 +5）' : ''}
      <div class="muted">「${esc(x.m.text)}」</div>
      <div class="verdict ${x.j.level}">${esc(x.j.why)}</div></div>`;
  }).join('');

  const missHtml = missed.length ? `<h2>你库里还有货没用上</h2>` + missed.map(x =>
    `<div class="miss-item">「${esc(x.m.text)}」<div class="muted">它正好适合第 ${x.slot + 1} 个槽位（${SLOT_TYPES[q.slots[x.slot].type].name}），下次别忘了。</div></div>`).join('')
    : '<p class="muted">你库里适合这道题的技能都用上了，没有浪费。</p>';

  $('resDetail').innerHTML = `<h2>逐槽点评</h2>${rows}${missHtml}
    <div id="aiBox"></div>`;
  view('result');
}

/* ---------------- AI 增强（走服务端代理，失败即静默降级） ---------------- */
async function enrichWithAi(q, detail) {
  const box = $('aiBox');
  if (!box) return;
  box.innerHTML = '<div class="notice">🤖 正在请 AI 补一段更具体的建议…</div>';
  try {
    // 只上报 ID，提示词由服务端拼；客户端无法向模型递任意文本
    const txt = await callReview({
      questId: q.id,
      grade: ME.grade,
      fills: detail.filter(x => x.m).map(x => ({ i: x.i, matId: x.m.id }))
    });
    box.innerHTML = `<h2>🤖 AI 的补充建议</h2><div class="notice good">${esc(txt).replace(/\n/g, '<br>')}</div>`;
  } catch (e) {
    box.innerHTML = `<div class="notice">🤖 AI 点评这次没拿到（${esc(e.message)}）。上面的逐槽点评是本地规则算的，照着改一样有效。</div>`;
  }
}

/* 调服务端点评接口。Key 在服务器上，浏览器里没有任何凭据。 */
async function callReview(payload, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs || 50000);
  try {
    const res = await fetch('api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctl.signal
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || ('HTTP ' + res.status));
    if (!d.text) throw new Error('返回里没有点评');
    return d.text;
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? '超时' : (e.message === 'Failed to fetch' ? '连不上服务器（本地直接双击打开时没有 AI）' : e.message));
  } finally { clearTimeout(timer); }
}

/* ---------------- 服务端自检 ---------------- */
async function runSelfTest() {
  const log = $('connLog');
  log.hidden = false;
  const put = s => { log.textContent += s + '\n'; log.scrollTop = log.scrollHeight; };
  log.textContent = '';

  put('[1/2] 查服务端状态…');
  let health = null;
  try {
    const r = await fetch('api/health', { cache: 'no-store' });
    health = await r.json();
    put(`  ✓ 服务端在线：素材 ${health.corpus} 条，题目 ${health.quests} 道，AI ${health.ai ? '已配置（' + health.model + '）' : '未配置'}`);
  } catch (e) {
    put('  × 没有服务端（你现在是本地直接双击打开的文件）。');
    put('  → 规则点评、背诵、拼搭全部照常，只是没有 AI 补充建议。');
    return;
  }

  put('[2/2] 真实请一次 AI 点评（用第一道题的一条素材）…');
  if (!health.ai) { put('  – 跳过：服务端没配置模型 Key。'); return; }
  try {
    const t0 = Date.now();
    const txt = await callReview({ questId: QUESTS[0].id, grade: ME ? ME.grade : 4, fills: [{ i: 0, matId: 'p03' }] }, 50000);
    put(`  ✓ 通了，${Date.now() - t0}ms，模型说：${txt.slice(0, 40)}…`);
    put('  → AI 点评可用。');
  } catch (e) {
    put(`  × 不通：${e.message}`);
    put('  → 规则点评照常工作，不影响打怪。');
  }
}

/* ---------------- 绑定 ---------------- */
function bindBattle() {
  $('submitBtn').onclick = submitBattle;
  $('pickerClose').onclick = () => { hidePicker(); renderSlots(); };
  $('pickerMask').onclick = hidePicker;
  $('againBtn').onclick = () => {
    // 重打时怪兽回满血：上一轮的伤害不能累加，否则“换一条再提交”会假通关
    const q = quest(battle.questId);
    battle.judged = false;
    setHp(maxHp(q), maxHp(q));
    renderSlots();
    view('battle');
  };
  $('resHome').onclick = renderHome;
}
