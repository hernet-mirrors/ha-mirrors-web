// fancyIndex.js - Directory listing enhancement
document.addEventListener("DOMContentLoaded", function () {
  // 生成面包屑导航
  function generateBreadcrumb() {
    const path = document.getElementById("path").textContent;
    const breadcrumbNav = document.getElementById("breadcrumb-nav");

    if (!breadcrumbNav || !path) return;

    const pathParts = path.split("/").filter((part) => part.length > 0);
    let breadcrumbHTML =
      '<li class="breadcrumb-item"><a href="/"><i class="fas fa-home"></i> 镜像站</a></li>';

    let currentPath = "";
    pathParts.forEach((part, index) => {
      currentPath += "/" + part;
      const isLast = index === pathParts.length - 1;

      if (isLast) {
        breadcrumbHTML += `<li class="breadcrumb-item active" aria-current="page">${part}</li>`;
      } else {
        breadcrumbHTML += `<li class="breadcrumb-item"><a href="${currentPath}/">${part}</a></li>`;
      }
    });

    breadcrumbNav.innerHTML = breadcrumbHTML;
  }

  // 生成镜像信息卡片
  function generateMirrorCard() {
    const path = document.getElementById("path").textContent;
    const mirrorCardContainer = document.getElementById("now-browsing-mirror");

    if (!mirrorCardContainer || !path) return;

    const pathParts = path.split("/").filter((part) => part.length > 0);
    if (pathParts.length === 0) return;

    const mirrorName = pathParts[0];

    // 镜像信息数据
    const mirrorInfo = {
      ubuntu: {
        name: "Ubuntu",
        description: "流行的 Linux 发行版 Ubuntu 的安装镜像和官方软件包仓库",
        help: true,
        isNew: false,
      },
      debian: {
        name: "Debian",
        description: "Debian GNU/Linux 的安装镜像和官方软件包仓库",
        help: true,
        isNew: false,
      },
      centos: {
        name: "CentOS",
        description: "CentOS Linux 的安装镜像和软件包仓库",
        help: true,
        isNew: false,
      },
      docker: {
        name: "Docker Hub",
        description: "Docker Hub 镜像仓库",
        help: true,
        isNew: true,
      },
      pypi: {
        name: "PyPI",
        description: "Python 包索引镜像",
        help: true,
        isNew: false,
      },
    };

    const info = mirrorInfo[mirrorName.toLowerCase()];

    if (!info) {
      mirrorCardContainer.innerHTML = `
        <div class="card border-secondary" style="max-width: 320px;">
          <div class="card-body p-2">
            <h6 class="card-title mb-1">
              <i class="fas fa-cube"></i> ${mirrorName}
            </h6>
            <p class="card-text small text-muted mb-0">文件浏览</p>
          </div>
        </div>
      `;
      return;
    }

    const helpButton = info.help
      ? `<a href="/help/${mirrorName.toLowerCase()}/" class="btn btn-outline-info btn-sm ml-2" title="查看使用帮助"><i class="fas fa-question-circle"></i></a>`
      : "";

    const newBadge = info.isNew
      ? '<span class="badge badge-primary badge-sm mr-1">新镜像</span>'
      : "";

    mirrorCardContainer.innerHTML = `
      <div class="card border-info" style="max-width: 320px;">
        <div class="card-body p-2">
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <h6 class="card-title mb-1">
                <i class="fas fa-cube"></i> ${info.name}
              </h6>
              <p class="card-text small text-muted mb-1">${info.description}</p>
            </div>
            ${helpButton}
          </div>
          <div class="mt-1">
            ${newBadge}
            <span class="badge badge-secondary badge-sm">目录浏览</span>
          </div>
        </div>
      </div>
    `;
  }

  // 初始化面包屑导航和镜像信息
  generateBreadcrumb();
  generateMirrorCard();

  // 检查帮助页面是否存在的函数
  function checkHelpPageExists(mirrorName) {
    // 这个列表应该与后端的帮助页面列表保持同步
    const knownHelpPages = [
      "alpine",
      "anaconda",
      "arch4edu",
      "archlinux",
      "archlinuxarm",
      "archlinuxcn",
      "centos",
      "debian",
      "docker",
      "epel",
      "fedora",
      "homebrew",
      "kali",
      "manjaro",
      "opensuse",
      "pypi",
      "ubuntu",
      "ubuntu-ports",
    ];
    return knownHelpPages.includes(mirrorName.toLowerCase());
  }

  // 为文件列表表格添加样式类
  const listTable = document.getElementById("list");
  if (listTable) {
    listTable.className = "table table-hover";

    // 格式化时间显示
    const timeCells = listTable.querySelectorAll("tbody tr td:nth-child(3)");
    timeCells.forEach((cell) => {
      const dateText = cell.textContent.trim();
      const date = new Date(dateText);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear().toString().padStart(4, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");

        cell.textContent = `${year}-${month}-${day} ${hours}:${minutes}`;
      }
    });

    // 为不同文件类型添加图标
    const nameLinks = listTable.querySelectorAll("tbody tr td:first-child a");
    nameLinks.forEach((link) => {
      const fileName = link.textContent.trim();
      const icon = document.createElement("i");
      icon.style.marginRight = "8px";
      icon.setAttribute("aria-hidden", "true");

      if (fileName === "../") {
        icon.className = "fas fa-level-up-alt";
        icon.title = "Parent Directory";
      } else if (fileName.endsWith("/")) {
        icon.className = "fas fa-folder";
        icon.title = "Directory";
      } else {
        // 根据文件扩展名设置图标
        const ext = fileName.split(".").pop().toLowerCase();
        switch (ext) {
          case "zip":
          case "tar":
          case "gz":
          case "bz2":
          case "xz":
          case "7z":
          case "rar":
            icon.className = "fas fa-file-archive";
            icon.title = "Archive File";
            break;
          case "iso":
          case "img":
            icon.className = "fas fa-compact-disc";
            icon.title = "Disk Image";
            break;
          case "txt":
          case "md":
          case "readme":
            icon.className = "fas fa-file-text";
            icon.title = "Text File";
            break;
          case "pdf":
            icon.className = "fas fa-file-pdf";
            icon.title = "PDF File";
            break;
          case "deb":
          case "rpm":
          case "pkg":
          case "dmg":
          case "exe":
          case "msi":
            icon.className = "fas fa-download";
            icon.title = "Package File";
            break;
          default:
            icon.className = "fas fa-file";
            icon.title = "File";
        }
      }

      link.insertBefore(icon, link.firstChild);
    });
  }

  // 实现当前浏览镜像信息显示和面包屑导航
  const pathElement = document.getElementById("path");
  const nowBrowsingElement = document.getElementById("now-browsing-mirror");
  const breadcrumbElement = document.getElementById("breadcrumb-nav");

  if (pathElement) {
    const currentPath = pathElement.textContent;
    const pathParts = currentPath.split("/").filter((part) => part.length > 0);

    // 生成面包屑导航
    if (breadcrumbElement && pathParts.length > 0) {
      let breadcrumbHTML =
        '<li class="breadcrumb-item"><a href="/"><i class="fas fa-home"></i> 镜像站</a></li>';
      let currentUrl = "";

      for (let i = 0; i < pathParts.length; i++) {
        currentUrl += "/" + pathParts[i];
        const isLast = i === pathParts.length - 1;

        if (isLast) {
          breadcrumbHTML += `<li class="breadcrumb-item active" aria-current="page">${pathParts[i]}</li>`;
        } else {
          breadcrumbHTML += `<li class="breadcrumb-item"><a href="${currentUrl}/">${pathParts[i]}</a></li>`;
        }
      }

      breadcrumbElement.innerHTML = breadcrumbHTML;
    }

    // 显示镜像信息卡片
    if (nowBrowsingElement && pathParts.length > 0) {
      const mirrorName = pathParts[0];

      // 尝试从镜像配置中获取镜像信息
      fetch("/static/mirror-desc.json")
        .then((response) => response.json())
        .then((data) => {
          // 尝试多种方式匹配镜像名称（原名、小写、大写）
          let mirrorInfo =
            data.mirrors[mirrorName] ||
            data.mirrors[mirrorName.toLowerCase()] ||
            data.mirrors[mirrorName.toUpperCase()];

          if (mirrorInfo) {
            const isNew =
              data.new_mirrors && data.new_mirrors.includes(mirrorName);
            const hasHelp = checkHelpPageExists(mirrorName);

            nowBrowsingElement.innerHTML = `
                            <div class="card border-info" style="max-width: 320px;">
                                <div class="card-body p-2">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div class="flex-grow-1">
                                            <h6 class="card-title mb-1">
                                                <i class="fas fa-cube"></i> ${
                                                  mirrorInfo.name
                                                }
                                            </h6>
                                            <p class="card-text small text-muted mb-1">${
                                              mirrorInfo.description ||
                                              "镜像仓库"
                                            }</p>
                                        </div>
                                        ${
                                          hasHelp
                                            ? `<a href="/help/${mirrorName.toLowerCase()}/" class="btn btn-outline-info btn-sm ml-2" title="查看使用帮助"><i class="fas fa-question-circle"></i></a>`
                                            : ""
                                        }
                                    </div>
                                    <div class="mt-1">
                                        ${
                                          isNew
                                            ? '<span class="badge badge-primary badge-sm mr-1">新镜像</span>'
                                            : ""
                                        }
                                        <span class="badge badge-secondary badge-sm">目录浏览</span>
                                    </div>
                                </div>
                            </div>
                        `;
          } else {
            const hasHelp = checkHelpPageExists(mirrorName);

            nowBrowsingElement.innerHTML = `
                            <div class="card border-secondary" style="max-width: 320px;">
                                <div class="card-body p-2">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div class="flex-grow-1">
                                            <h6 class="card-title mb-1">
                                                <i class="fas fa-cube"></i> ${mirrorName}
                                            </h6>
                                            <p class="card-text small text-muted mb-0">文件浏览</p>
                                        </div>
                                        ${
                                          hasHelp
                                            ? `<a href="/help/${mirrorName.toLowerCase()}/" class="btn btn-outline-info btn-sm ml-2" title="查看使用帮助"><i class="fas fa-question-circle"></i></a>`
                                            : ""
                                        }
                                    </div>
                                </div>
                            </div>
                        `;
          }
        })
        .catch(() => {
          // 如果获取镜像信息失败，显示简单的信息
          const hasHelp = checkHelpPageExists(pathParts[0]);

          nowBrowsingElement.innerHTML = `
                        <div class="card border-secondary" style="max-width: 320px;">
                            <div class="card-body p-2">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div class="flex-grow-1">
                                        <h6 class="card-title mb-1">
                                            <i class="fas fa-folder-open"></i> 文件浏览
                                        </h6>
                                        <p class="card-text small text-muted mb-0">${currentPath}</p>
                                    </div>
                                    ${
                                      hasHelp
                                        ? `<a href="/help/${pathParts[0].toLowerCase()}/" class="btn btn-outline-info btn-sm ml-2" title="查看使用帮助"><i class="fas fa-question-circle"></i></a>`
                                        : ""
                                    }
                                </div>
                            </div>
                        </div>
                    `;
        });
    }
  }
});
