/* 作文积木服务端：静态托管 + AI 点评代理。零依赖，Node 18+。
 *
 * 为什么需要它（见 docs/adr/0003）：
 *   1. 模型 Key 必须留在服务器，绝不进浏览器——公网地址上任何人都能读 JS 源码。
 *   2. 同源请求，绕开 CORS（跨域限制）。
 *   3. 代理只接受素材 ID，不接受任意文本：提示词由服务端用自己那份 corpus/quests 拼装，
 *      所以别人无法把这个接口当成免费的大模型来用。
 *
 * 启动需要的环境变量：
 *   ZWJM_KEY      模型 API Key（必填，不要写进任何仓库文件）
 *   ZWJM_BASE     OpenAI 兼容端点，默认 token-plan
 *   ZWJM_MODEL    模型名，默认 qwen3.8-flash
 *   PORT          监听端口，默认 8080
 *   ZWJM_PREFIX   可选。设为 /zw 时，本应用挂在 /zw 下，
 *                 其余路径全部反向代理给 ZWJM_UPSTREAM（用来与别的站共享 80 端口）
 *   ZWJM_UPSTREAM 上游地址，如 http://127.0.0.1:5173
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);
const KEY = process.env.ZWJM_KEY || '';
const BASE = (process.env.ZWJM_BASE || 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
const MODEL = process.env.ZWJM_MODEL || 'qwen3.8-flash';
const PREFIX = (process.env.ZWJM_PREFIX || '').replace(/\/$/, '');   // 例：/zw
const UPSTREAM = process.env.ZWJM_UPSTREAM || '';                    // 例：http://127.0.0.1:5173

/* ---------- 载入内容库：服务端保有自己那份，客户端只能报 ID ---------- */
const { CORPUS } = require('./corpus.js');
const { SLOT_TYPES, QUESTS } = require('./quests.js');
const matById = new Map(CORPUS.map(m => [m.id, m]));
const questById = new Map(QUESTS.map(q => [q.id, q]));

/* ---------- 判定规则：与前端 battle.js 保持同一套口径 ---------- */
function judgeOne(m, slot) {
  if (!m.slotTypes.includes(slot.type)) return 'none';
  const expect = slot.expectSubjects || [];
  if (!expect.length || m.subjects.includes('通用') || m.subjects.some(s => expect.includes(s))) return 'full';
  return 'half';
}

function buildPrompt(quest, grade, items) {
  const lines = items.map(({ slot, m, level }) =>
    `槽位「${SLOT_TYPES[slot.type].name}」（这道题这里要写：${(slot.expectSubjects || []).join('/') || '不限'}）填了：「${m.text}」，规则判定：${level === 'full' ? '完全契合' : level === 'half' ? '位置对但对象不符' : '放错位置'}`);
  return `你在帮一个小学${grade}年级的孩子看他的作文选材。
作文题目：《${quest.title}》，题目背景：${quest.brief}
他把背过的句子填进了骨架，情况如下：
${lines.join('\n')}

请用亲切、具体、不打分的口气，写 3-5 句话的点评。要求：
1. 先肯定一处他选得好的，说清为什么好。
2. 对「位置对但对象不符」的，给出具体的改写方向（比如把某个比喻换成更贴合的），但不要替他写完整句子。
3. 对「放错位置」的，直接说清它应该放到哪种段落去。
4. 不要用「同学你真棒」这类空话，不要提「规则判定」这四个字。
只输出点评正文，不要标题、不要列表编号、不要 Markdown 符号。`;
}

/* ---------- 限流：防止公网地址被人当免费额度刷 ---------- */
const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 30;
const GLOBAL_PER_HOUR = 400;
const ipHits = new Map();
let globalHits = [];

function rateLimited(ip) {
  const now = Date.now();
  globalHits = globalHits.filter(t => now - t < 3600000);
  if (globalHits.length >= GLOBAL_PER_HOUR) return '今天来的小朋友太多了，等一会儿再试';
  const rec = ipHits.get(ip);
  if (!rec || now > rec.resetAt) { ipHits.set(ip, { n: 1, resetAt: now + WINDOW_MS }); }
  else if (rec.n >= PER_IP) { return '这一会儿点得太快了，先歇十分钟再让 AI 说话'; }
  else { rec.n++; }
  globalHits.push(now);
  if (ipHits.size > 5000) ipHits.clear();
  return null;
}

/* ---------- 调模型 ---------- */
async function callModel(prompt) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45000);
  try {
    const res = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 700,
        enable_thinking: false        // 这是带思考链的模型，点评不需要，省时间也省钱
      }),
      signal: ctl.signal
    });
    const text = await res.text();
    if (!res.ok) throw new Error('上游 HTTP ' + res.status + ' ' + text.slice(0, 200));
    const d = JSON.parse(text);
    const msg = d.choices && d.choices[0] && d.choices[0].message;
    const out = msg && (msg.content || '').trim();
    if (!out) throw new Error('上游没有返回点评内容');
    return out;
  } finally { clearTimeout(timer); }
}

/* ---------- HTTP ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(body);
}
function sendJson(res, code, obj) { send(res, code, JSON.stringify(obj)); }

function readBody(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > limit) { reject(new Error('请求体过大')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleReview(req, res, ip) {
  const limit = rateLimited(ip);
  if (limit) return sendJson(res, 429, { error: limit });

  let body;
  try { body = JSON.parse(await readBody(req)); }
  catch (e) { return sendJson(res, 400, { error: '请求格式不对' }); }

  const quest = questById.get(String(body.questId || ''));
  if (!quest) return sendJson(res, 400, { error: '题目不存在' });
  const grade = [4, 5, 6].includes(Number(body.grade)) ? Number(body.grade) : 5;

  const fills = Array.isArray(body.fills) ? body.fills.slice(0, 12) : [];
  const items = [];
  for (const f of fills) {
    const slot = quest.slots[Number(f.i)];
    const m = matById.get(String(f.matId || ''));
    if (!slot || !m) continue;                       // 只认 ID，认不出就丢掉
    items.push({ slot, m, level: judgeOne(m, slot) });
  }
  if (!items.length) return sendJson(res, 400, { error: '没有可点评的内容' });

  try {
    const text = await callModel(buildPrompt(quest, grade, items));
    sendJson(res, 200, { text, model: MODEL });
  } catch (e) {
    console.error('[review]', e.message);            // 只记错误摘要，绝不记 Key
    sendJson(res, 502, { error: e.name === 'AbortError' ? 'AI 想得太久了，先看规则点评' : 'AI 暂时联系不上，先看规则点评' });
  }
}

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p === '') p = '/index.html';
  const full = path.join(ROOT, path.normalize(p).replace(/^([.][.][/\\])+/, ''));
  if (!full.startsWith(ROOT)) return send(res, 403, '越界', 'text/plain; charset=utf-8');
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, '找不到这个页面', 'text/plain; charset=utf-8');
    send(res, 200, data, MIME[path.extname(full).toLowerCase()] || 'application/octet-stream');
  });
}

/* ---------- 反向代理：不属于本应用的请求原样转给上游（共享 80 端口） ---------- */
function proxyToUpstream(req, res) {
  const target = new URL(UPSTREAM);
  const p = http.request({
    host: target.hostname,
    port: target.port || 80,
    method: req.method,
    path: req.url,
    headers: req.headers               // 保留 Host，上游看到的和直连时一模一样
  }, up => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  p.on('error', e => {
    console.error('[proxy]', e.code || e.message);
    send(res, 502, '上游暂时没响应（游戏服务可能正在重启，稍等刷新）', 'text/plain; charset=utf-8');
  });
  req.pipe(p);
}

http.createServer(async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
  try {
    /* 共享端口模式：只接管 PREFIX 下的请求，其余全部转给上游 */
    if (PREFIX && UPSTREAM) {
      if (req.url === PREFIX) {                       // /zw → /zw/ ，不然相对路径会指到站点根
        res.writeHead(301, { Location: PREFIX + '/' });
        return res.end();
      }
      if (req.url.startsWith(PREFIX + '/')) {
        req.url = req.url.slice(PREFIX.length) || '/';
      } else {
        return proxyToUpstream(req, res);
      }
    }

    if (req.url.startsWith('/api/health')) {
      return sendJson(res, 200, { ok: true, ai: !!KEY, model: MODEL, corpus: CORPUS.length, quests: QUESTS.length });
    }
    if (req.url.startsWith('/api/review')) {
      if (req.method !== 'POST') return sendJson(res, 405, { error: '只接受 POST' });
      if (!KEY) return sendJson(res, 503, { error: '服务端没有配置模型 Key，只有规则点评' });
      return handleReview(req, res, ip);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '不支持', 'text/plain; charset=utf-8');
    serveStatic(req, res);
  } catch (e) {
    console.error('[server]', e.message);
    sendJson(res, 500, { error: '服务器内部错误' });
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`作文积木 已启动 :${PORT}  模型=${MODEL}  AI=${KEY ? '开' : '关（缺 Key）'}  素材=${CORPUS.length} 条  题目=${QUESTS.length} 道`);
  if (PREFIX && UPSTREAM) console.log(`共享端口模式：${PREFIX}/ → 本应用，其余路径 → ${UPSTREAM}`);
});
