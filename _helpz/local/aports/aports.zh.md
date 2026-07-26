## 简介

`aports` 是 Alpine Linux 的软件包源码仓库，主要维护各软件包的 `APKBUILD`、补丁和安装脚本。

## 准备

先访问 [alpine/aports](https://gitlab.alpinelinux.org/alpine/aports)，注册 GitLab 账号并 fork 仓库。后续提交通过个人 fork 发起 Merge Request。

## 克隆

国内访问 GitLab 较慢，可以从本站镜像克隆：

```{ztmpl lang="bash"}
git clone {{endpoint}}
cd aports
```

## 远程仓库

推荐保留两个远程：从镜像拉取，向 GitLab fork 推送。

### 设置 origin 为个人 fork

SSH：

```bash
# 请将 qaqland 替换为你的 GitLab 用户名
git remote set-url origin git@gitlab.alpinelinux.org:qaqland/aports.git
```

HTTPS：

```bash
# 请将 qaqland 替换为你的 GitLab 用户名
git remote set-url origin https://gitlab.alpinelinux.org/qaqland/aports.git
```

### 添加镜像远程

```{ztmpl lang="bash"}
git remote add mirror {{endpoint}}
```

### 让 master 从镜像更新

之后在 `master` 上执行 `git pull` 会从本站镜像拉取：

```bash
git branch -u mirror/master master
```

## 检查配置

查看远程仓库：

```bash
git remote -v
```

确认 `origin` 指向个人 fork，`mirror` 指向本站镜像。

## 日常工作流

`master` 只用来同步上游更新，修改请放在新分支。

提交前建议先阅读仓库内的 `CODINGSTYLE.md` 和 `COMMITSTYLE.md`，确认打包和提交信息格式。

### 同步 master

```bash
git checkout master
git pull
```

### 新建分支

```bash
# 分支命名建议：包含修改的软件包名和简要描述
git checkout -b fix-community-nginx-config
```

### 修改并提交

```bash
# 修改文件
git add .
git commit -m "community/nginx: fix default config path"
```

### 推送到个人 fork

```bash
git push origin fix-community-nginx-config
```

### 发起 Merge Request

推送后，在 GitLab 的 fork 仓库页面选择新分支，点击 "Create merge request"，提交到 `alpine/aports`。
