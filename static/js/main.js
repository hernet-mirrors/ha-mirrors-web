// 下拉菜单功能
document.addEventListener("DOMContentLoaded", function () {
  // 移动端菜单切换
  const menuIcon = document.querySelector(".menu-icon");
  const navList = document.querySelector(".nav-list");

  if (menuIcon && navList) {
    menuIcon.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      navList.classList.toggle("active");
      menuIcon.classList.toggle("active");
      menuIcon.setAttribute(
        "aria-expanded",
        navList.classList.contains("active")
      );
      // 汉堡动画
      const bars = menuIcon.querySelectorAll(".bar");
      if (bars.length === 3) {
        bars[0].style.transform = navList.classList.contains("active")
          ? "rotate(-45deg) translate(-5px, 6px)"
          : "none";
        bars[1].style.opacity = navList.classList.contains("active")
          ? "0"
          : "1";
        bars[2].style.transform = navList.classList.contains("active")
          ? "rotate(45deg) translate(-5px, -6px)"
          : "none";
      }
    });
    // 点击空白关闭菜单
    document.addEventListener("click", function (e) {
      if (!menuIcon.contains(e.target) && !navList.contains(e.target)) {
        navList.classList.remove("active");
        menuIcon.classList.remove("active");
        menuIcon.setAttribute("aria-expanded", "false");
        // 重置汉堡动画
        const bars = menuIcon.querySelectorAll(".bar");
        bars.forEach((bar) => {
          bar.style.transform = "none";
          bar.style.opacity = "1";
        });
      }
    });
  }

  // 移动端下拉菜单处理 - 禁用二级菜单展开
  const hasSubmenuItems = document.querySelectorAll(".has-submenu");
  hasSubmenuItems.forEach((item) => {
    const link = item.querySelector("a");
    const submenu = item.querySelector(".submenu");
    if (link && submenu) {
      link.addEventListener("click", function (e) {
        if (window.innerWidth <= 768) {
          // 移动端禁用二级菜单展开，允许直接跳转到一级菜单链接
          // 不阻止默认行为，让一级菜单链接正常工作
          return;
        }
      });
    }
  });

  // 桌面端下拉菜单悬停效果
  if (window.innerWidth > 768) {
    hasSubmenuItems.forEach((item) => {
      const submenu = item.querySelector(".submenu");
      if (submenu) {
        item.addEventListener("mouseenter", function () {
          submenu.style.display = "block";
        });

        item.addEventListener("mouseleave", function () {
          submenu.style.display = "none";
        });
      }
    });
  }

  // 响应式处理
  window.addEventListener("resize", function () {
    if (window.innerWidth > 768) {
      // 桌面端：隐藏移动端菜单并重置汉堡菜单
      if (navList) {
        navList.classList.remove("active");
      }
      if (menuIcon) {
        menuIcon.classList.remove("active");
        menuIcon.setAttribute("aria-expanded", "false");
      }

      // 重置汉堡菜单
      const bars = document.querySelectorAll(".menu-icon .bar");
      bars.forEach((bar) => {
        bar.style.transform = "none";
        bar.style.opacity = "1";
      });
    }
  });
});

// 主要JavaScript功能
const CONFIG = {
  MIRRORZ_API_BASE: "https://mirrorz.org/api/v1",
  SITE_ID: "ha",
  AUTO_REFRESH_INTERVAL: 5 * 60 * 1000, // 5分钟
  ANIMATION_DURATION: 300,
};

// 工具函数
const Utils = {
  // 格式化时间
  formatTime: function (timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN");
  },

  // 格式化文件大小
  formatFileSize: function (bytes) {
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  },

  // 防抖函数
  debounce: function (func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // 节流函数
  throttle: function (func, limit) {
    let inThrottle;
    return function () {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // 显示加载状态
  showLoading: function (element) {
    if (element) {
      element.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <p class="mt-2 text-muted">正在加载...</p>
                </div>
            `;
    }
  },

  // 显示错误信息
  showError: function (element, message) {
    if (element) {
      element.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${message || "加载失败，请稍后重试"}
                </div>
            `;
    }
  },

  // 复制到剪贴板
  copyToClipboard: function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard
        .writeText(text)
        .then(() => {
          this.showToast("已复制到剪贴板", "success");
        })
        .catch(() => {
          this.fallbackCopyTextToClipboard(text);
        });
    } else {
      this.fallbackCopyTextToClipboard(text);
    }
  },

  // 备用复制方法
  fallbackCopyTextToClipboard: function (text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand("copy");
      this.showToast("已复制到剪贴板", "success");
    } catch (err) {
      this.showToast("复制失败", "error");
    }

    document.body.removeChild(textArea);
  },

  // 显示提示信息
  showToast: function (message, type = "info") {
    // 创建toast容器（如果不存在）
    let toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toast-container";
      toastContainer.className =
        "toast-container position-fixed top-0 end-0 p-3";
      toastContainer.style.zIndex = "9999";
      document.body.appendChild(toastContainer);
    }

    // 创建toast元素
    const toastId = "toast-" + Date.now();
    const toastElement = document.createElement("div");
    toastElement.id = toastId;
    toastElement.className = "toast";
    toastElement.setAttribute("role", "alert");

    const typeColors = {
      success: "text-bg-success",
      error: "text-bg-danger",
      warning: "text-bg-warning",
      info: "text-bg-info",
    };

    const typeIcons = {
      success: "fas fa-check-circle",
      error: "fas fa-times-circle",
      warning: "fas fa-exclamation-triangle",
      info: "fas fa-info-circle",
    };

    toastElement.innerHTML = `
            <div class="toast-header ${typeColors[type]}">
                <i class="${typeIcons[type]} me-2"></i>
                <strong class="me-auto">提示</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;

    toastContainer.appendChild(toastElement);

    // 显示toast
    const toast = new bootstrap.Toast(toastElement, {
      autohide: true,
      delay: 3000,
    });
    toast.show();

    // 移除toast元素
    toastElement.addEventListener("hidden.bs.toast", () => {
      toastElement.remove();
    });
  },
};

// API服务
const APIService = {
  // 获取镜像列表
  getMirrors: async function () {
    try {
      // 这里应该调用实际的API
      // const response = await fetch(`${CONFIG.MIRRORZ_API_BASE}/mirrors`);
      // return await response.json();

      // 模拟数据
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            data: [
              // 镜像数据...
            ],
          });
        }, 1000);
      });
    } catch (error) {
      console.error("获取镜像列表失败:", error);
      throw error;
    }
  },

  // 获取同步状态
  getSyncStatus: async function () {
    try {
      // 模拟API调用
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            data: {
              // 状态数据...
            },
          });
        }, 1000);
      });
    } catch (error) {
      console.error("获取同步状态失败:", error);
      throw error;
    }
  },

  // 获取帮助文档
  getHelpDoc: async function (mirrorName) {
    try {
      // 这里应该调用MirrorZ API
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            data: {
              content: `# ${mirrorName} 使用帮助\n\n这是 ${mirrorName} 的使用说明...`,
            },
          });
        }, 500);
      });
    } catch (error) {
      console.error("获取帮助文档失败:", error);
      throw error;
    }
  },
};

// 页面交互功能
const PageInteractions = {
  // 初始化搜索功能
  initSearch: function () {
    const searchInputs = document.querySelectorAll("[data-search]");
    searchInputs.forEach((input) => {
      input.addEventListener(
        "input",
        Utils.debounce((e) => {
          const searchTerm = e.target.value.toLowerCase();
          const targetSelector = e.target.dataset.search;
          const items = document.querySelectorAll(targetSelector);

          items.forEach((item) => {
            const text = item.textContent.toLowerCase();
            const isVisible = text.includes(searchTerm);
            item.style.display = isVisible ? "" : "none";
          });
        }, 300)
      );
    });
  },

  // 初始化过滤功能
  initFilters: function () {
    const filterSelects = document.querySelectorAll("[data-filter]");
    filterSelects.forEach((select) => {
      select.addEventListener("change", (e) => {
        const filterValue = e.target.value;
        const targetSelector = e.target.dataset.filter;
        const items = document.querySelectorAll(targetSelector);

        items.forEach((item) => {
          if (!filterValue) {
            item.style.display = "";
          } else {
            const itemValue = item.dataset.category || item.dataset.type;
            item.style.display = itemValue === filterValue ? "" : "none";
          }
        });
      });
    });
  },

  // 初始化复制按钮
  initCopyButtons: function () {
    const copyButtons = document.querySelectorAll("[data-copy]");
    copyButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const textToCopy = button.dataset.copy || button.textContent.trim();
        Utils.copyToClipboard(textToCopy);
      });
    });
  },

  // 初始化工具提示
  initTooltips: function () {
    const tooltipTriggerList = [].slice.call(
      document.querySelectorAll('[data-bs-toggle="tooltip"]')
    );
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  },

  // 初始化弹出框
  initPopovers: function () {
    const popoverTriggerList = [].slice.call(
      document.querySelectorAll('[data-bs-toggle="popover"]')
    );
    popoverTriggerList.map(function (popoverTriggerEl) {
      return new bootstrap.Popover(popoverTriggerEl);
    });
  },

  // 平滑滚动
  initSmoothScroll: function () {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute("href"));
        if (target) {
          target.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      });
    });
  },

  // 返回顶部按钮
  initBackToTop: function () {
    // 创建返回顶部按钮
    const backToTopBtn = document.createElement("button");
    backToTopBtn.className = "btn btn-primary position-fixed";
    backToTopBtn.style.cssText = `
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            display: none;
        `;
    backToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopBtn.title = "返回顶部";
    document.body.appendChild(backToTopBtn);

    // 监听滚动事件
    window.addEventListener(
      "scroll",
      Utils.throttle(() => {
        if (window.pageYOffset > 300) {
          backToTopBtn.style.display = "block";
        } else {
          backToTopBtn.style.display = "none";
        }
      }, 100)
    );

    // 点击返回顶部
    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  },
};

// 主题切换功能
const ThemeManager = {
  init: function () {
    const savedTheme = localStorage.getItem("theme") || "auto";
    this.setTheme(savedTheme);
    this.addThemeToggle();
  },

  setTheme: function (theme) {
    document.documentElement.setAttribute("data-bs-theme", theme);
    localStorage.setItem("theme", theme);
    this.updateThemeIcon(theme);
  },

  addThemeToggle: function () {
    const themeToggle = document.createElement("button");
    themeToggle.className = "btn btn-outline-light btn-sm ms-2";
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    themeToggle.title = "切换主题";

    themeToggle.addEventListener("click", () => {
      const currentTheme =
        document.documentElement.getAttribute("data-bs-theme");
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      this.setTheme(newTheme);
    });

    const navbar = document.querySelector(".navbar-nav:last-child");
    if (navbar) {
      const li = document.createElement("li");
      li.className = "nav-item";
      li.appendChild(themeToggle);
      navbar.appendChild(li);
    }
  },

  updateThemeIcon: function (theme) {
    const icon = document.querySelector('.btn[title="切换主题"] i');
    if (icon) {
      icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
    }
  },
};

// 页面加载动画
const PageLoader = {
  show: function () {
    const loader = document.createElement("div");
    loader.id = "page-loader";
    loader.className =
      "position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white";
    loader.style.zIndex = "9999";
    loader.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">正在加载...</p>
            </div>
        `;
    document.body.appendChild(loader);
  },

  hide: function () {
    const loader = document.getElementById("page-loader");
    if (loader) {
      loader.style.opacity = "0";
      setTimeout(() => loader.remove(), 300);
    }
  },
};

// 滚动增强
const ScrollEnhancer = {
  init: function () {
    this.addBackToTop();
    this.addScrollProgress();
    this.handleScrollAnimations();
  },

  addBackToTop: function () {
    const backToTop = document.createElement("button");
    backToTop.className = "btn btn-primary position-fixed";
    backToTop.style.cssText =
      "bottom: 20px; right: 20px; z-index: 1000; border-radius: 50%; width: 50px; height: 50px; opacity: 0; transition: all 0.3s ease;";
    backToTop.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTop.title = "返回顶部";

    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("scroll", () => {
      if (window.pageYOffset > 300) {
        backToTop.style.opacity = "1";
        backToTop.style.pointerEvents = "auto";
      } else {
        backToTop.style.opacity = "0";
        backToTop.style.pointerEvents = "none";
      }
    });

    document.body.appendChild(backToTop);
  },

  addScrollProgress: function () {
    const progress = document.createElement("div");
    progress.className = "position-fixed top-0 start-0 bg-primary";
    progress.style.cssText =
      "height: 3px; z-index: 9999; transition: width 0.1s ease;";

    window.addEventListener("scroll", () => {
      const scrolled =
        (window.pageYOffset /
          (document.documentElement.scrollHeight - window.innerHeight)) *
        100;
      progress.style.width = scrolled + "%";
    });

    document.body.appendChild(progress);
  },

  handleScrollAnimations: function () {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("fade-in-up");
          }
        });
      },
      { threshold: 0.1 }
    );

    document
      .querySelectorAll(".card, .feature-item, .stat-item")
      .forEach((el) => {
        observer.observe(el);
      });
  },
};

// 搜索增强
const SearchEnhancer = {
  init: function () {
    this.addSearchSuggestions();
    this.addSearchHistory();
  },

  addSearchSuggestions: function () {
    const searchInputs = document.querySelectorAll(
      'input[type="text"][placeholder*="搜索"]'
    );
    searchInputs.forEach((input) => {
      const datalist = document.createElement("datalist");
      datalist.id = input.id + "-suggestions";

      const suggestions = [
        "ubuntu",
        "debian",
        "centos",
        "pypi",
        "npm",
        "docker",
        "maven",
        "golang",
      ];

      suggestions.forEach((suggestion) => {
        const option = document.createElement("option");
        option.value = suggestion;
        datalist.appendChild(option);
      });

      input.setAttribute("list", datalist.id);
      input.parentNode.appendChild(datalist);
    });
  },

  addSearchHistory: function () {
    const searchInputs = document.querySelectorAll(
      'input[type="text"][placeholder*="搜索"]'
    );
    searchInputs.forEach((input) => {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && input.value.trim()) {
          this.saveSearchHistory(input.value.trim());
        }
      });
    });
  },

  saveSearchHistory: function (query) {
    let history = JSON.parse(localStorage.getItem("searchHistory") || "[]");
    history = history.filter((item) => item !== query);
    history.unshift(query);
    history = history.slice(0, 10); // 保留最近10条
    localStorage.setItem("searchHistory", JSON.stringify(history));
  },
};

// 性能监控
const PerformanceMonitor = {
  init: function () {
    this.measurePageLoad();
    this.monitorNetworkStatus();
  },

  measurePageLoad: function () {
    window.addEventListener("load", () => {
      const loadTime = performance.now();
      console.log(`页面加载时间: ${loadTime.toFixed(2)}ms`);

      if (loadTime > 3000) {
        this.showPerformanceWarning();
      }
    });
  },

  monitorNetworkStatus: function () {
    window.addEventListener("online", () => {
      this.showNetworkStatus("网络已连接", "success");
    });

    window.addEventListener("offline", () => {
      this.showNetworkStatus("网络已断开", "danger");
    });
  },

  showPerformanceWarning: function () {
    const toast = this.createToast("页面加载较慢，可能是网络问题", "warning");
    document.body.appendChild(toast);
  },

  showNetworkStatus: function (message, type) {
    const toast = this.createToast(message, type);
    document.body.appendChild(toast);
  },

  createToast: function (message, type) {
    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.style.cssText =
      "position: fixed; top: 20px; right: 20px; z-index: 9999;";
    toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

    setTimeout(() => toast.remove(), 3000);
    return toast;
  },
};

// 河南省教育科研网主站导航栏功能
document.addEventListener("DOMContentLoaded", function () {
  // 移动端菜单切换
  const menuIcon = document.querySelector(".menu-icon");
  const navList = document.querySelector(".nav-list");

  if (menuIcon && navList) {
    menuIcon.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      navList.classList.toggle("active");
      menuIcon.classList.toggle("active");
      menuIcon.setAttribute(
        "aria-expanded",
        navList.classList.contains("active")
      );
      // 汉堡动画
      const bars = menuIcon.querySelectorAll(".bar");
      if (bars.length === 3) {
        bars[0].style.transform = navList.classList.contains("active")
          ? "rotate(-45deg) translate(-5px, 6px)"
          : "none";
        bars[1].style.opacity = navList.classList.contains("active")
          ? "0"
          : "1";
        bars[2].style.transform = navList.classList.contains("active")
          ? "rotate(45deg) translate(-5px, -6px)"
          : "none";
      }
    });

    // 点击空白关闭菜单
    document.addEventListener("click", function (e) {
      if (!menuIcon.contains(e.target) && !navList.contains(e.target)) {
        navList.classList.remove("active");
        menuIcon.classList.remove("active");
        menuIcon.setAttribute("aria-expanded", "false");
        // 重置汉堡动画
        const bars = menuIcon.querySelectorAll(".bar");
        bars.forEach((bar) => {
          bar.style.transform = "none";
          bar.style.opacity = "1";
        });
      }
    });
  }

  // 移动端下拉菜单处理
  const hasSubmenuItems = document.querySelectorAll(".has-submenu");
  hasSubmenuItems.forEach((item) => {
    const link = item.querySelector("a");
    const submenu = item.querySelector(".submenu");

    if (link && submenu) {
      link.addEventListener("click", function (e) {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          // 只展开当前，关闭其他
          hasSubmenuItems.forEach((i) => {
            if (i !== item) i.classList.remove("active");
          });
          item.classList.toggle("active");
        }
      });
    }
  });

  // 桌面端下拉菜单悬停效果
  if (window.innerWidth > 768) {
    hasSubmenuItems.forEach((item) => {
      const submenu = item.querySelector(".submenu");
      if (submenu) {
        item.addEventListener("mouseenter", function () {
          submenu.style.display = "block";
        });

        item.addEventListener("mouseleave", function () {
          submenu.style.display = "none";
        });
      }
    });
  }

  // 响应式处理
  window.addEventListener("resize", function () {
    if (window.innerWidth > 768) {
      navList.classList.remove("active");
      menuIcon.classList.remove("active");

      // 重置汉堡菜单
      const bars = document.querySelectorAll(".menu-icon .bar");
      bars.forEach((bar) => {
        bar.style.transform = "none";
        bar.style.opacity = "1";
      });
    }
  });
}); // <-- 只保留这一个闭合，删除多余的

const currentPath = window.location.pathname;
const navLinks = document.querySelectorAll(".nav-list a");

navLinks.forEach((link) => {
  const href = link.getAttribute("href");
  if (
    href &&
    (currentPath === href || (href !== "/" && currentPath.startsWith(href)))
  ) {
    link.classList.add("sec_navnowbottom");
  }
});

// 右侧边栏自适应居中功能
function adjustSidebarPosition() {
  const sidebarContainer = document.querySelector(".sidebar-container");
  const sidebarContent = document.querySelector(".sidebar-content");

  if (!sidebarContainer || !sidebarContent) return;

  // 只在大屏幕下处理
  if (window.innerWidth >= 992) {
    const viewportHeight = window.innerHeight;
    const navbarHeight = document.querySelector(".navbar")?.offsetHeight || 80; // 固定导航栏高度
    const sidebarHeight = sidebarContent.scrollHeight; // 使用scrollHeight获取完整高度
    const availableHeight = viewportHeight - navbarHeight - 100; // 100px为上下边距

    // 如果sidebar内容高度超过可用高度，使用sticky顶部对齐
    if (sidebarHeight > availableHeight) {
      sidebarContainer.classList.add("tall-content");
      // 动态计算合适的top值，考虑固定导航栏
      const topOffset = Math.max(20, navbarHeight + 40);
      sidebarContainer.style.top = topOffset + "px";
      sidebarContainer.style.transform = "none";
      sidebarContent.style.maxHeight = `calc(100vh - ${topOffset + 40}px)`;
    } else {
      // 否则使用垂直居中
      sidebarContainer.classList.remove("tall-content");
      sidebarContainer.style.top = "50%";
      sidebarContainer.style.transform = "translateY(-50%)";
      sidebarContent.style.maxHeight = "none";
    }
  } else {
    // 移动端重置样式
    sidebarContainer.classList.remove("tall-content");
    sidebarContainer.style.top = "";
    sidebarContainer.style.transform = "";
    sidebarContent.style.maxHeight = "";
  }
}

// 防抖函数用于sidebar调整
function debounceSidebarAdjust(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 使用防抖处理窗口调整
const debouncedAdjustSidebar = debounceSidebarAdjust(
  adjustSidebarPosition,
  150
);

// 页面加载时调用
document.addEventListener("DOMContentLoaded", adjustSidebarPosition);

// 窗口调整时调用（防抖）
window.addEventListener("resize", debouncedAdjustSidebar);

// 监听内容变化（比如镜像列表加载完成后）
const sidebarObserver = new MutationObserver(debouncedAdjustSidebar);
const sidebarTargetNode = document.querySelector(".sidebar-content");
if (sidebarTargetNode) {
  sidebarObserver.observe(sidebarTargetNode, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });
}

// 主初始化函数
function initializeApp() {
  // 基础功能初始化
  PageInteractions.initSearch();
  PageInteractions.initFilters();
  PageInteractions.initCopyButtons();
  PageInteractions.initTooltips();
  PageInteractions.initPopovers();
  PageInteractions.initSmoothScroll();
  PageInteractions.initBackToTop();

  // 主题切换
  ThemeManager.init();

  // 滚动增强
  ScrollEnhancer.init();

  // 搜索增强
  SearchEnhancer.init();

  // 性能监控
  PerformanceMonitor.init();

  // 页面加载器
  PageLoader.hide();

  console.log("河南省教育科研网镜像站初始化完成");
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", initializeApp);

// 导出全局对象（供其他脚本使用）
window.HAMirrors = {
  Utils,
  APIService,
  PageInteractions,
  CONFIG,
};

// 河南省教育科研网主站搜索功能
// 页眉滚动效果
const HeaderScrollEffect = {
  init: function () {
    const header = document.querySelector(".header");
    if (!header) return;

    let lastScrollY = window.scrollY;

    window.addEventListener("scroll", () => {
      const currentScrollY = window.scrollY;

      // 添加滚动样式类
      if (currentScrollY > 50) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }

      // 滚动方向检测（可选）
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // 向下滚动
        header.style.transform = "translateY(-100%)";
      } else {
        // 向上滚动或在顶部
        header.style.transform = "translateY(0)";
      }

      lastScrollY = currentScrollY;
    });
  },
};

// 初始化页眉滚动效果
document.addEventListener("DOMContentLoaded", function () {
  HeaderScrollEffect.init();
});

// 页脚微信图标交互功能
document.addEventListener("DOMContentLoaded", function () {
  // 微信图标悬停效果
  const wechatIcons = [
    { trigger: "showWechat", container: "imageContainer" },
    { trigger: "showWechatOne", container: "imageContainerOne" },
    { trigger: "showWechatTwo", container: "imageContainerTwo" },
  ];

  wechatIcons.forEach(({ trigger, container }) => {
    const triggerEl = document.getElementById(trigger);
    const containerEl = document.getElementById(container);

    if (triggerEl && containerEl) {
      triggerEl.addEventListener("mouseenter", function () {
        containerEl.classList.add("show");
        containerEl.style.opacity = "1";
      });

      triggerEl.addEventListener("mouseleave", function () {
        containerEl.classList.remove("show");
        containerEl.style.opacity = "0";
      });
    }
  });
});
