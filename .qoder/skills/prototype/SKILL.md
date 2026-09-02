---
name: prototype
description: 创建或编辑 .canvas.tsx 视觉工件，在 Canvas 预览面板里渲染，用于改正式代码前的 UI 与交互原型验证。当用户要求做原型、prototype、预览界面效果、改版先看效果、或提到 canvas.tsx 工件时使用。
---

# prototype — UI 原型（.canvas.tsx）

改 styles.css / app.js / battle.js 之前，先做可预览的原型对齐视觉与交互，用户批准后再落地到正式代码。

## 硬规则

1. 原型放在 `prototypes/` 目录，文件名 `<主题>.canvas.tsx`（如 `duolingo-path.canvas.tsx`），一个原型只演示一个主题。
2. 每个原型是自包含单文件 React 函数组件（default export）：不 import 工程任何代码、不依赖构建工具，样式全用内联 `style` 或组件内常量。要用设计 token 时现读 `styles.css` 的 `:root` 抄成字面量（不要在本文件里维护一份 token 表，会过期）。
3. 假数据用真实素材：从 `corpus.js` 里抄几条 `text` 当示例文案，别用 lorem ipsum 或「测试文本」。
4. 原型只用于预览：不被 index.html / server.js 引用、不上线；批准后把效果移植回正式代码，移植完成后原型可删。
5. `prototypes/` 已被 .gitignore 排除、不提交；落地的功能改动按 AGENTS.md 跑完验证清单后单独 commit，提交信息注明「落地原型：<主题>」。
6. 受众是小学 4-6 年级孩子：字号偏大、点按目标偏大、正反馈明显、不用灰暗配色。

## 工件骨架

```tsx
export default function Prototype() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', fontFamily: 'system-ui' }}>
      {/* 用 corpus.js 里的真实 text 当假数据 */}
    </div>
  );
}
```

## 原型做完后

1. 请用户在 Canvas 面板预览并提意见，迭代到批准为止。
2. 移植：每个视觉改动对应 styles.css 的一处改动；每个交互改动对应 app.js / battle.js 的最小改动，禁止顺手重构无关代码。
3. 移植完跑 AGENTS.md 验证清单，通过后 commit。
