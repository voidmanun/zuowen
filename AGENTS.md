# AGENTS.md — 作文积木（zuowen-jimu）

小学 4-6 年级作文训练网页应用：背诵素材转为技能，挑战里把技能拼进作文骨架打怪兽。
术语表见 `CONTEXT.md`，架构决策见 `docs/adr/`。本文件是编码代理在本仓库必须遵守的约定。

## 提交规则（必须遵守）

**每个功能完成并测试通过后，立即 commit。**

- 一次 commit 只装一个功能，不把多个功能混在一个提交里。
- 「测试通过」= 下面验证清单全部执行且无失败；清单没跑完不许提交。
- 测试不通过时，先修复或回退本次改动；禁止带病提交，禁止绕过检查提交。
- 提交信息用一句中文说清做了什么，如「背诵验收改为词语级拼接」。
- 禁止 `git push --force`（尤其 main 分支），禁止 `--no-verify` 跳过钩子。

## 验证清单（每次 commit 前必须跑）

1. 语法：五个 JS 文件全部通过
   `node --check app.js && node --check corpus.js && node --check quests.js && node --check battle.js && node --check server.js`
2. 语料自检（chunks 与 text 逐字一致，预期输出 0）：
   `node -e "const{CORPUS}=require('./corpus.js');let bad=[];for(const m of CORPUS){if(m.chunks.join('')!==m.text)bad.push(m.id)};console.log(bad.length,CORPUS.length)"`
3. 改了 server.js / corpus.js / quests.js 之后，重启线上服务并冒烟：
   `systemctl restart zuowen-jimu.service && curl -s http://127.0.0.1/zw/api/health`
   预期 `"corpus":100`。注意根路径 `/` 是反代给上游游戏页面的，健康检查必须带 `/zw` 前缀。

## 项目速览

- 零依赖：浏览器端 `corpus.js`（素材+人工词块）、`quests.js`（题材/题目/骨架）、`app.js`（档案/背诵验收）、`battle.js`（拼搭判定+AI 点评）；服务端 `server.js`（静态托管 + AI 代理，模型 Key 只在服务器）。
- 进度只存浏览器 localStorage，一台电脑多个档案，无账号。
- 线上由 systemd 管理：`zuowen-jimu.service`。共享端口模式：`/zw/` → 本应用，其余路径 → vite 上游（如 share_game 的 5173）。
- 改素材文本必须同步维护 `chunks` 人工词块：自动分词（Intl.Segmenter）只作兜底，join 自检失败会自动退回兜底，功能不崩但体验降级。
