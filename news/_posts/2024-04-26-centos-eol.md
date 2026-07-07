---
layout: news
title: CentOS 仓库即将停止服务
date: 2024-04-26
author: Fu Pan
category: news
---

根据 CentOS 项目上游 [安排](https://blog.centos.org/2023/04/end-dates-are-coming-for-centos-stream-8-and-centos-linux-7/)：

 * CentOS Stream 8 将于 2024 年 5 月 31 日结束维护
 * CentOS 7 将于 2024 年 6 月 30 日结束维护
 * CentOS Linux 系列将在此后成为历史，软件仓库清空，请使用[Stream 9](https://mirror.nyist.edu.cn/centos-stream/) 及后续版本使用另外的软件仓库

因应以上情况，考虑到 CentOS 7 在校内各单位使用的广泛程度，本站作出如下安排：

 * 6 月 29 日起，停止 CentOS 7 软件仓库更新，暂时保留 CentOS 7 仓库的最后状态
 * 7 月 1 日起，重定向请求至 [Centos-Vault](https://mirror.nyist.edu.cn/centos-vault/)
 * 8 月 1 日起，关闭互联网访问，仅允许校内访问
 * 9 月 1 日起，删除 centos 仓库

建议仍在使用相关版本 CentOS 操作系统的师生和单位，尽快完成系统迁移，改用其他发行版：
 * 迁移到由原 CentOS 项目的创始人之一发起的 [Rocky Linux](https://mirror.nyist.edu.cn/rocky/) 项目
 * 改用其他发行版如 Fedora 、Debian 、Ubuntu 等
 * 升级到 CentOS Stream 9 或更高版本
 * 迁移到 RedHat 企业版 Linux (RHEL)（商业软件，无镜像）
  
请各位用户维护系统前注意备份数据!