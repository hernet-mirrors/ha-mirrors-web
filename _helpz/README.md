# _helpz — 帮助页面生成

本目录参考 [tuna/mirror-web `_helpz`](https://github.com/tuna/mirror-web/tree/master/_helpz) 设计，
基于 [mirrorz-docs](https://github.com/mirrorz-org/mirrorz-docs) 生成各镜像的使用帮助。

## 结构

```
_helpz/
├── .gitmodules            # 指向 mirrorz-docs (嵌套 submodule)
├── global/                # mirrorz-docs 子模块（上游，原样使用）
├── local/                 # 本站覆盖（与 global 同名目录/文件会被优先使用）
├── enabled.yaml           # 本站启用的帮助页面列表
├── generate.mjs           # Node.js 构建脚本
├── templates.mjs          # 表单 / 代码块 HTML 模板（无 React）
└── flattenData.mjs        # 输入值展平工具
```

## 初始化

首次 clone 仓库或拉取本次提交后：

```bash
git submodule update --init --recursive
```

Node 依赖在项目根目录 `package.json` 中，安装：

```bash
npm install
```

## 构建

`_plugins/helpz.rb` 在 `jekyll build` 时自动执行 `generate.mjs`，把每个启用的镜像生成成一篇
Jekyll post（写到 `.jekyll-cache/helpz/<name>.md`），并注册为 `help` collection。

## 添加镜像帮助

- **上游已有**（最常见）：把镜像名追加到 `enabled.yaml` 即可。
- **本站覆盖 / 私有页面**：在 `local/<name>/` 下放置 `<name>.yaml` 与对应 `index.<lang>.md`。
  相同文件存在时 `local/` 优先于 `global/`。
