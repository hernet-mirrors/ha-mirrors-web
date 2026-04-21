# 河南省教育科研网开源软件镜像站 部署指南

本项目基于 Jekyll 构建，使用 [mirrorz-docs](https://github.com/mirrorz-org/mirrorz-docs)
作为帮助页面上游；生成流程参考了 [tuna/mirror-web `_helpz`](https://github.com/tuna/mirror-web/tree/master/_helpz)。

## 一、环境准备

- Ruby >= 3.2 + Bundler
- Node.js >= 18（用于 `_helpz/generate.mjs`）
- Git（拉取子模块）
- 推荐 Linux / WSL

## 二、Clone

```bash
git clone --recurse-submodules https://github.com/hernet-mirrors/ha-mirrors-web.git
```

已 clone 未带子模块：

```bash
git submodule update --init --recursive
```

拉取子模块更新：

```bash
git pull --recurse-submodules
git submodule update --init --recursive --remote
```

> **从旧版本升级**：老仓库里 `help/_posts/mirrorz-help-ha-transpiled` 子模块已删除。
> 若本地还有残留，运行：
> ```bash
> git submodule deinit -f help/_posts/mirrorz-help-ha-transpiled 2>/dev/null || true
> rm -rf help .git/modules/help
> ```

## 三、本地构建

```bash
# 安装 Ruby 依赖
bundle install

# 安装 Node 依赖（_helpz/generate.mjs 需要）
npm install

# 可选：复制 Hogan.js / hljs 的浏览器运行时到 static/js/
node scripts/fetch-runtime.mjs
# 下载 highlight.js 浏览器 bundle（必需）：
curl -o static/js/highlight.min.js \
  https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js
# 可选：覆盖默认 hljs 主题
curl -o static/css/hljs.css \
  https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css

# 启动本地预览
bundle exec jekyll serve
```

访问 <http://localhost:4000>。

## 四、Docker 构建

```bash
# 先拉取最新 Dockerfile.build（修复了 bundler --frozen 报错）
git pull --ff-only
git submodule update --init --recursive

# --no-cache 强制忽略可能残留的旧层
docker build --no-cache -f Dockerfile.build -t ha-mirrors-web:build .
docker run --rm -v "$(pwd)/_site":/data/_site ha-mirrors-web:build
```

构建完成后静态文件在 `_site/`。

> **若仍然报 `bundle install --frozen` 相关的 "list of sources changed"**：
> 说明当前目录里的 `Dockerfile.build` 还是老版本（commit `bd0d44f` 之前）。
> 执行 `git log -1 Dockerfile.build` 确认 Hash 应该是 `bd0d44f` 或之后。

## 五、目录结构

```
_config.yml                 # Jekyll 配置（包含 helpz.language / helpz.dir 等）
_data/options.yml           # 镜像描述、分类等
_helpz/                     # mirrorz-docs 风格帮助生成（见 _helpz/README.md）
├── global/                  (submodule → mirrorz-docs)
├── local/                   (本站覆盖)
├── enabled.yaml             (启用的页面列表)
├── generate.mjs             (Node.js 构建脚本)
├── templates.mjs / flattenData.mjs
_plugins/helpz.rb           # Jekyll 插件，构建时调用 generate.mjs
_includes/                  # 头、尾、头部导航
_layouts/                   # default / help / index / news / page / minimal
static/                     # 静态资源（CSS / JS / 图片 / njs）
```

## 六、添加帮助页面

多数镜像上游已有文档——只需把镜像名加入 `_helpz/enabled.yaml`。
若需本站私有覆盖或新增未收录页面，把 `<镜像名>.yaml` + `index.zh.md` 等
文件放到 `_helpz/local/<镜像名>/`（与 `_helpz/global/` 同路径）。

## 七、常见问题

- 修改 `_config.yml` 以自定义站点信息。
- 镜像描述、ISO、磁盘等数据在 `static/` 目录。
- `static/njs/` 下的脚本由 nginx njs 运行时使用（与网页无关）。

## 八、参考命令

- 清理：`bundle clean && rm -rf .jekyll-cache _site`
- 重装：`bundle install --redownload`

---

如有问题请提交 issue 或联系维护者。
