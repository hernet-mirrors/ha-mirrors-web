# 河南省教育科研网开源软件镜像站 部署指南

本项目基于 Jekyll 构建，使用 [mirrorz-docs](https://github.com/mirrorz-org/mirrorz-docs)
作为帮助页面上游；生成流程参考了 [tuna/mirror-web `_helpz`](https://github.com/tuna/mirror-web/tree/master/_helpz)。

## 分支说明（main / nyist-web）

- **`main`**：河南省教育科研网镜像站（mirrors.ha.edu.cn，蓝色主题）。
- **`nyist-web`**：南阳理工学院镜像站（mirror.nyist.edu.cn，深红主题）。与 main 共享全部代码，
  只在品牌层面不同：`static/css/main.css` 与 `static/css/maintenance.css` 顶部 `:root` 的变量值、
  `_config.yml`、`_includes/footer.html`、header/maintenance 的 logo 图、`static/img/` 素材、
  `news/_posts/` 新闻、首页友情链接。

**工作流**：功能改动一律在 `main` 上进行，然后合并到 nyist-web：

```bash
git checkout nyist-web
git merge main
```

改颜色时只改 `:root` 里的变量值（品牌色都已集中在 `main.css` / `maintenance.css` 顶部），
不要在其他 CSS 里写死色值，否则两个分支会重新发散。

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

## 三、构建前：拉取运行时数据

`static/disk.json`、`static/isoinfo.json`、`static/tunasync.json` 是镜像站运行时生成的实时数据（磁盘占用、ISO 镜像元数据、tunasync 同步状态），不纳入仓库版本控制。**构建前必须从
线上镜像站拉取**，否则首页镜像列表、同步状态页、ISO 下载弹窗都会加载失败。

```bash
mkdir -p static
curl -fsSL -o static/disk.json      https://mirrors.ha.edu.cn/static/disk.json
curl -fsSL -o static/isoinfo.json   https://mirrors.ha.edu.cn/static/isoinfo.json
curl -fsSL -o static/tunasync.json  https://mirrors.ha.edu.cn/static/tunasync.json
```

> 如果没有 `curl`，用 `wget -O <path> <url>` 等价替换。三者均位于
> `https://mirrors.ha.edu.cn/static/` 下，由 nginx 直接提供。

## 四、本地构建

```bash
# 安装 Ruby 依赖
bundle install

# 安装 Node 依赖（_helpz/generate.mjs 和 JS 混淆需要）
npm install

# 启动本地预览
bundle exec jekyll serve

# 生产构建（编译 + JS 混淆）
bundle exec jekyll build
node build-js.mjs
```

访问 <http://localhost:4000>。

构建完成后混淆后的 JS 文件在 `_site/static/js/`。

## 五、Docker 构建

```bash
git pull --ff-only
git submodule update --init --recursive

# 同上：先拉取运行时数据到宿主 static/
curl -fsSL -o static/disk.json      https://mirrors.ha.edu.cn/static/disk.json
curl -fsSL -o static/isoinfo.json   https://mirrors.ha.edu.cn/static/isoinfo.json
curl -fsSL -o static/tunasync.json  https://mirrors.ha.edu.cn/static/tunasync.json

docker build -f Dockerfile.build -t ha-mirrors-web:build .
docker run --rm -v "$(pwd)":/data ha-mirrors-web:build
```

构建完成后静态文件在 `_site/`，JS 文件已自动混淆。

## 六、目录结构

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

## 七、添加帮助页面

多数镜像上游已有文档——只需把镜像名加入 `_helpz/enabled.yaml`。
若需本站私有覆盖或新增未收录页面，把 `<镜像名>.yaml` + `index.zh.md` 等
文件放到 `_helpz/local/<镜像名>/`（与 `_helpz/global/` 同路径）。

## 八、常见问题

- 修改 `_config.yml` 以自定义站点信息。
- `static/options.json` 由 Jekyll 从 `_data/options.yml` 渲染，镜像描述
  只需改 YAML；`static/disk.json` / `isoinfo.json` / `tunasync.json` 由
  镜像站运行时生成，见 [第三节](#三构建前拉取运行时数据)。
- `static/njs/` 下的脚本由 nginx njs 运行时使用（与网页无关）。

## 九、参考命令

- 清理：`bundle clean && rm -rf .jekyll-cache _site`
- 重装：`bundle install --redownload`

---

如有问题请提交 issue 或联系维护者。
