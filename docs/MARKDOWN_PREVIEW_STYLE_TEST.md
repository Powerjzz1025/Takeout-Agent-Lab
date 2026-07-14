# Markdown 预览样式测试

测试日期：2026-07-10

测试目的：用同一份内容对比 Codex 右侧 `.md` 预览和同名 `.html` 预览的显示差异，重点观察标题层级、代码块灰底、引用块、表格、列表、行内代码和提示块。

## 1. 标题层级

### 三级标题

#### 四级标题

这是一段普通正文。理想状态下，正文应该和标题有清晰的字号、字重、行距差异。中文段落应该有舒适的阅读宽度，英文和数字如 `http://127.0.0.1:5177/` 不应挤在一起。

## 2. 行内样式

这是 **加粗文本**、*斜体文本*、`行内代码`、[链接文本](https://developers.openai.com/codex/app/settings) 的混合段落。

可以观察：

- 加粗是否明显
- 行内代码是否有浅灰背景
- 链接是否有颜色区分
- 列表缩进是否自然

## 3. 引用块

> 这是一个引用块。理想状态下，引用块应该有左侧边线或浅灰背景，用来和普通正文区分。
>
> 第二段引用文本，用来观察多段引用的行距和边距。

## 4. 代码块

```bash
npm install
npm start
PORT=5176 npm start
```

```js
function summarizeResult(cases) {
  const passed = cases.filter((item) => item.status === "pass").length;
  const failed = cases.length - passed;

  return {
    total: cases.length,
    passed,
    failed,
    passRate: `${Math.round((passed / cases.length) * 100)}%`,
  };
}
```

```json
{
  "model": "deepseek-v4-flash",
  "endpoint": "/api/llm-review",
  "temperature": 0.2,
  "maxRounds": 3
}
```

## 5. 表格

| 场景 | 结果 | 单轮耗时 | 备注 |
| --- | --- | ---: | --- |
| 用户改口 | 通过 | 12.4s | 保留旧约束 |
| 多人点餐 | 部分通过 | 18.9s | 需要拆分参与者 |
| 换一批推荐 | 失败 | 22.1s | 重复推荐过多 |
| 硬约束过滤 | 通过 | 9.8s | 结果稳定 |

## 6. 任务清单

- [x] 生成 Markdown 文件
- [x] 生成同名 HTML 文件
- [ ] 在 Codex 右侧预览 Markdown
- [ ] 在浏览器或侧边栏打开 HTML
- [ ] 对比灰底、边距、字体层级

## 7. 分隔线

---

## 8. 提示块模拟

> 注意：标准 Markdown 没有内建的“提示块”语义。不同渲染器可能只把它当普通引用块，因此灰底、图标、边框不一定一致。

## 9. 长段落

这是一段较长的中文说明，用来观察右侧预览器是否能保持清晰的阅读节奏。一个好的文档预览应该避免所有内容都贴在白底上没有层次，也应该让代码块、引用块、表格和普通段落之间有足够的视觉差异。如果 `.md` 预览器的样式缺失，通常会看到所有模块都变成接近白底，只剩文字本身。

