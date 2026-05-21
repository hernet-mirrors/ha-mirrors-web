// Idempotent guard: bail out if main.js already ran on this page.
// Prevents SyntaxError / duplicate listeners if the file is ever included twice.
if (window.__haMirrorsMainJsLoaded) {
  // eslint-disable-next-line no-console
  console.warn("main.js already loaded, skipping duplicate execution");
} else {
  window.__haMirrorsMainJsLoaded = true;

// `var` (not `let`) so accidental double-load doesn't throw a SyntaxError.
var mirrorsData              = window.mirrorsData              || [];
var mirrorDescriptions       = window.mirrorDescriptions       || {};
var newMirrors               = window.newMirrors               || [];
var unlistedMirrors          = window.unlistedMirrors          || [];
var forceRedirectHelpMirrors = window.forceRedirectHelpMirrors || [];
var labelMap                 = window.labelMap                 || {};

var tunasyncDataPromise = window.tunasyncDataPromise || null;

/**
 * Returns true only when a mirror record has a non-empty, non-whitespace name.
 * Guards against blank rows that can arise from build-time obfuscation artifacts
 * or malformed runtime data.
 * @param {object} record - A mirror record.
 * @returns {boolean}
 */
function isValidMirror(record) {
  return (
    record &&
    typeof record === "object" &&
    typeof record.name === "string" &&
    record.name.trim().length > 0
  );
}

/**
 * Filters an array of mirror records, returning only valid entries and logging
 * a concise warning for each invalid entry to aid debugging without changing UI.
 * @param {Array} records - Raw mirror records (may contain null/invalid entries).
 * @param {string} source - Label describing the data source (e.g. "tunasync.json", "unlisted_mirror").
 * @returns {Array} Filtered array containing only valid mirror records.
 */
function filterValidMirrors(records, source) {
  if (!Array.isArray(records)) return [];
  const valid = [];
  records.forEach((r) => {
    if (isValidMirror(r)) {
      valid.push(r);
    } else {
      console.warn(
        "[ha-mirrors] Skipping mirror record with missing/blank name from " +
          source +
          ":",
        r
      );
    }
  });
  return valid;
}

// Global error handler for debugging
window.addEventListener("error", function (e) {
  console.error("Global error caught:", e.error);
  console.error("Error details:", e.filename, e.lineno, e.colno);
});

// Promise rejection handler
window.addEventListener("unhandledrejection", function (e) {
  console.error("Unhandled promise rejection:", e.reason);
});

// Bootstrap availability check
function isBootstrapReady() {
  return (
    typeof bootstrap !== "undefined" &&
    bootstrap.Modal &&
    typeof bootstrap.Modal === "function"
  );
}

// Safe Bootstrap Modal creation
function createSafeModal(element, options = {}) {
  if (!isBootstrapReady()) {
    console.error("Bootstrap is not available");
    return null;
  }

  if (!element) {
    console.error("Modal element not found");
    return null;
  }

  try {
    const defaultOptions = {
      backdrop: true,
      keyboard: true,
      focus: false, // 改为false，避免自动焦点管理冲突
    };

    const modal = new bootstrap.Modal(element, {
      ...defaultOptions,
      ...options,
    });

    // 确保模态框实例正确绑定到元素
    element._bsModal = modal;

    return modal;
  } catch (error) {
    console.error("Error creating Bootstrap modal:", error);
    return null;
  }
}

// Safe link opening function
function openSafeLink(url, target = "_blank") {
  try {
    if (target === "_blank") {
      // 使用 window.open 以更好地处理弹窗阻止
      const newWindow = window.open(url, "_blank", "noopener,noreferrer");
      if (!newWindow) {
        // 如果被阻止，降级到当前窗口
        console.warn("Popup blocked, opening in current window");
        window.location.href = url;
      }
    } else {
      window.location.href = url;
    }
  } catch (error) {
    console.error("Error opening link:", error);
    // 最后的降级方案
    window.location.href = url;
  }
}

// Utility function for copying text to clipboard
function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      // 使用现代 Clipboard API
      navigator.clipboard
        .writeText(text)
        .then(() => {
          console.log("Text copied to clipboard");
        })
        .catch((err) => {
          console.error("Failed to copy text:", err);
          fallbackCopy(text);
        });
    } else {
      // 降级到传统方法
      fallbackCopy(text);
    }
  } catch (error) {
    console.error("Error copying to clipboard:", error);
    fallbackCopy(text);
  }
}

// Fallback copy method
function fallbackCopy(text) {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    console.log("Text copied using fallback method");
  } catch (err) {
    console.error("Fallback copy failed:", err);
  }
}

/**
 * Gets tunasync data with caching to avoid duplicate requests
 */
function getTunasyncData() {
  if (tunasyncDataPromise) {
    console.log("Using cached tunasync data promise");
    return tunasyncDataPromise;
  }

  console.log("Creating new tunasync data request");

  // Create a promise with timeout
  tunasyncDataPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.log("Tunasync fetch timed out");
      reject(new Error("Fetch timeout"));
    }, 5000); // 5 second timeout

    fetch("/static/tunasync.json?_=" + Date.now())
      .then((response) => {
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then((data) => {
        // Sanitize before caching so displayMirrorInfo (which reads window.mirrorsData
        // directly) cannot crash on null/missing-name entries.
        const validData = filterValidMirrors(data, "tunasync.json");
        window.mirrorsData = validData;
        resolve(validData);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error("Failed to load tunasync.json:", error);
        tunasyncDataPromise = null; // Reset promise to allow retry
        reject(error);
      });
  });

  return tunasyncDataPromise;
}

/**
 * Loads mirror descriptions, new mirrors, unlisted mirrors,
 * force redirect help mirrors and label map from options.json
 * (tuna/mirror-web layout: top-level { options, helps }).
 */
async function loadMirrorDescriptions() {
  try {
    const response = await fetch("/static/options.json?_=" + Date.now());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const opts = (data && data.options) || {};

    // mirror_desc: [{ name, desc }] -> lowercased-name -> description
    if (Array.isArray(opts.mirror_desc)) {
      opts.mirror_desc.forEach((item) => {
        if (item && item.name) {
          mirrorDescriptions[item.name.trim().toLowerCase()] = item.desc || "";
        }
      });
    }

    if (Array.isArray(opts.new_mirrors))               newMirrors               = opts.new_mirrors;
    if (Array.isArray(opts.unlisted_mirrors))          unlistedMirrors          = opts.unlisted_mirrors;
    if (Array.isArray(opts.force_redirect_help_mirrors)) forceRedirectHelpMirrors = opts.force_redirect_help_mirrors;
    if (opts.label_map && typeof opts.label_map === "object") labelMap = opts.label_map;
  } catch (error) {
    console.error("Failed to load options.json:", error);
    mirrorDescriptions = {};
    newMirrors = [];
    unlistedMirrors = [];
    forceRedirectHelpMirrors = [];
    labelMap = {};
  }
}

/**
 * Gets the description for a mirror.
 * @param {string} mirrorName - The name of the mirror.
 * @returns {string} The mirror description.
 */
function getMirrorDescription(mirrorName) {
  const key = (mirrorName || "").trim().toLowerCase();
  const desc = mirrorDescriptions[key];
  return desc || mirrorName + " Open Source Software Mirror";
}

/**
 * Checks if a mirror is a new mirror.
 * @param {string} mirrorName - The name of the mirror.
 * @returns {boolean} True if the mirror is new, false otherwise.
 */
function isNewMirror(mirrorName) {
  return newMirrors.includes(mirrorName);
}

/**
 * Gets the badge for a new mirror.
 * @param {string} mirrorName - The name of the mirror.
 * @returns {string} The HTML for the new mirror badge.
 */
function getNewMirrorBadge(mirrorName) {
  if (isNewMirror(mirrorName)) {
    return '<span class="badge bg-warning text-dark ms-2"><i class="fas fa-star me-1"></i>New</span>';
  }
  return "";
}

/**
 * Custom sort function for mirrors: uppercase letters first (A-Z), then lowercase (a-z).
 * @param {object} a - The first mirror to compare.
 * @param {object} b - The second mirror to compare.
 * @returns {number} The sort order.
 */
function sortMirrorsByName(a, b) {
  const nameA = a.name;
  const nameB = b.name;

  for (let i = 0; i < Math.min(nameA.length, nameB.length); i++) {
    const charA = nameA[i];
    const charB = nameB[i];

    if (/[a-zA-Z]/.test(charA) && /[a-zA-Z]/.test(charB)) {
      const isUpperA = /[A-Z]/.test(charA);
      const isUpperB = /[A-Z]/.test(charB);

      if (isUpperA && !isUpperB) return -1;
      if (!isUpperA && isUpperB) return 1;

      if (charA.toLowerCase() !== charB.toLowerCase()) {
        return charA.toLowerCase().localeCompare(charB.toLowerCase());
      }
      if (charA !== charB) {
        return charA.localeCompare(charB);
      }
    } else {
      if (charA !== charB) {
        return charA.localeCompare(charB);
      }
    }
  }

  return nameA.length - nameB.length;
}

/**
 * Formats the file size into a human-readable string.
 * @param {string} sizeStr - The size string to format.
 * @returns {string} The formatted size string.
 */
function formatSize(sizeStr) {
  if (!sizeStr || sizeStr === "unknown") return "Unknown";

  const match = sizeStr.match(/^([\d.]+)([KMGT])$/);
  if (match) {
    const size = parseFloat(match[1]);
    const unit = match[2];
    return `${size.toFixed(2)} ${unit}B`;
  }

  const bytes = parseInt(sizeStr);
  if (isNaN(bytes)) return sizeStr;

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Formats a timestamp into a human-readable string.
 * @param {number} timestamp - The timestamp to format.
 * @returns {string} The formatted time string.
 */
function formatTime(timestamp) {
  if (!timestamp || timestamp <= 0) return "Unknown";

  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "Unknown";
  }
}

/**
 * Gets the status badge for a mirror.
 * @param {string} status - The status of the mirror.
 * @returns {string} The HTML for the status badge.
 */
function getStatusBadge(status) {
  let statusInfo;

  switch (status) {
    case "success":
      statusInfo = {
        text: "正常",
        class: "bg-success",
        icon: "fa-check-circle",
      };
      break;
    case "syncing":
    case "warning":
      statusInfo = {
        text: "同步中",
        class: "bg-warning",
        icon: "fa-sync-alt fa-spin",
      };
      break;
    case "failed":
    case "fail":
    case "error":
      statusInfo = {
        text: "失败",
        class: "bg-danger",
        icon: "fa-times-circle",
      };
      break;
    case "paused":
      statusInfo = {
        text: "暂停",
        class: "bg-info",
        icon: "fa-pause",
      };
      break;
    default: // unknown
      statusInfo = {
        text: "未知",
        class: "bg-secondary",
        icon: "fa-question",
      };
      break;
  }

  return `<span class="badge ${statusInfo.class}"><i class="fas ${statusInfo.icon} me-1"></i>${statusInfo.text}</span>`;
}

/**
 * Renders the mirror table.
 * @param {Array} mirrors - The array of mirrors to render.
 */
function renderMirrorTable(mirrors) {
  const tbody = document.getElementById("mirror-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  // Skip records with missing/blank names to avoid blank mirror rows after build.
  const validMirrors = mirrors.filter(isValidMirror);
  validMirrors.forEach((mirror) => {
    const row = document.createElement("tr");
    row.className = "mirror-row";

    const shouldRedirectToHelp = forceRedirectHelpMirrors.includes(mirror.name);

    let mirrorUrl;
    if (shouldRedirectToHelp) {
      mirrorUrl = getMirrorHelpUrl(mirror.name);
    } else if (mirror.url) {
      mirrorUrl = mirror.url;
    } else {
      mirrorUrl = `/${mirror.name}/`;
    }

    row.innerHTML = `
			<td data-label="Name">
				<strong><a href="${mirrorUrl}" class="text-decoration-none mirror-link" 
					title="${getMirrorDescription(
            mirror.name
          )}" data-bs-toggle="tooltip" data-bs-placement="top">${
      mirror.name
    }</a></strong>
				${
          helpPages[mirror.name]
            ? '<a href="' +
              helpPages[mirror.name] +
              '" class="ms-2" title="Help"><i class="fas fa-circle-question"></i></a>'
            : ""
        }
				${getNewMirrorBadge(mirror.name)}
			</td>
			<td data-label="Size"><small class="text-muted">${formatSize(
        mirror.size
      )}</small></td>
			<td data-label="Status">${getStatusBadge(mirror.status)}</td>
			<td data-label="Last Updated"><small class="text-muted">${formatTime(
        mirror.last_update_ts
      )}</small></td>
		`;
    tbody.appendChild(row);
  });
  initializeTooltips();
}

/**
 * Initializes the Bootstrap tooltips.
 */
function initializeTooltips() {
  const existingTooltips = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
  );
  existingTooltips.forEach((el) => {
    const tooltip = bootstrap.Tooltip.getInstance(el);
    if (tooltip) {
      tooltip.dispose();
    }
  });

  const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
  );
  if (typeof bootstrap !== "undefined" && bootstrap.Tooltip) {
    tooltipTriggerList.forEach(function (tooltipTriggerEl) {
      new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }
}

/**
 * Loads the mirror data and renders the table.
 */
async function loadMirrorData() {
  const loadingDiv = document.getElementById("mirror-loading");
  const tableContainer = document.getElementById("mirror-table-container");
  const errorDiv = document.getElementById("mirror-error");

  try {
    await loadMirrorDescriptions();

    // Use cached tunasync data (already sanitized by filterValidMirrors in getTunasyncData).
    const data = await getTunasyncData();

    if (Array.isArray(data)) {
      mirrorsData = data;
    } else {
      mirrorsData = [];
    }

    unlistedMirrors.forEach((unlistedMirror) => {
      // Skip virtual mirrors whose own name is missing/blank.
      if (!isValidMirror(unlistedMirror)) {
        console.warn(
          "[ha-mirrors] Skipping unlisted_mirror with missing/blank name:",
          unlistedMirror
        );
        return;
      }
      const existingMirror = mirrorsData.find(
        (m) => isValidMirror(m) && m.name === unlistedMirror.name
      );
      if (!existingMirror) {
        const linkToMirror = mirrorsData.find(
          (m) => isValidMirror(m) && m.name === unlistedMirror.link_to
        );

        const virtualMirror = {
          name: unlistedMirror.name,
          url: unlistedMirror.url,
          link_to: unlistedMirror.link_to,
        };

        if (linkToMirror) {
          virtualMirror.size = linkToMirror.size || "Unknown";
          virtualMirror.status = linkToMirror.status || "unknown";
          virtualMirror.last_update_ts = linkToMirror.last_update_ts || 0;
          virtualMirror.next_schedule_ts = linkToMirror.next_schedule_ts || 0;
          virtualMirror.last_started_ts = linkToMirror.last_started_ts || 0;
          virtualMirror.upstream = linkToMirror.upstream || "";
        } else {
          virtualMirror.size = "Unknown";
          virtualMirror.status = "unknown";
          virtualMirror.last_update_ts = 0;
          virtualMirror.next_schedule_ts = 0;
          virtualMirror.last_started_ts = 0;
          virtualMirror.upstream = "";
        }

        mirrorsData.push(virtualMirror);
      }
    });

    mirrorsData.sort(sortMirrorsByName);

    renderMirrorTable(mirrorsData);

    if (loadingDiv) loadingDiv.classList.add("d-none");
    if (tableContainer) tableContainer.classList.remove("d-none");

    enableMirrorSearch();
  } catch (error) {
    console.error("Failed to load mirror data:", error);

    if (loadingDiv) loadingDiv.classList.add("d-none");
    if (errorDiv) errorDiv.classList.remove("d-none");
  }
}

/**
 * Enables the mirror search functionality.
 */
function enableMirrorSearch() {
  const searchInput = document.getElementById("mirror-search");
  if (!searchInput) return;

  searchInput.addEventListener("input", function () {
    const filter = this.value.toLowerCase();
    const rows = document.querySelectorAll(".mirror-row");

    rows.forEach((row) => {
      const name = row
        .querySelector("td:first-child")
        .textContent.toLowerCase();

      if (name.includes(filter)) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    });
  });

  document.addEventListener("keydown", function (e) {
    if (
      e.key === "/" &&
      e.target.tagName !== "INPUT" &&
      e.target.tagName !== "TEXTAREA"
    ) {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

/**
 * Gets the help page URL for a mirror.
 * @param {string} name - The name of the mirror.
 * @returns {string} The help page URL.
 */
function getMirrorHelpUrl(name) {
  return "/help/" + name + "/";
}

// Fancyindex support functions
function initializeFancyIndex() {
  console.log("Starting fancyindex initialization");

  // Priority: Use cached tunasync data to avoid duplicate requests
  const fetchPromise = getTunasyncData()
    .then((data) => {
      console.log(
        "Tunasync data loaded for fancyindex",
        data ? data.length : 0,
        "mirrors"
      );
      return data;
    })
    .catch((error) => {
      console.log("Could not load tunasync.json in fancyindex:", error);
      window.mirrorsData = [];
      return [];
    });

  // Add timeout to prevent infinite waiting
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      console.log("Tunasync fetch timeout, proceeding with UI setup");
      resolve([]);
    }, 2000); // Reduced to 2 seconds
  });

  // Race between fetch and timeout
  Promise.race([fetchPromise, timeoutPromise])
    .then(() => {
      console.log("Proceeding with fancyindex UI setup");
      // Now proceed with other initializations
      try {
        setupFancyIndexUI();
        setupFancyIndexHeader();
        console.log("Fancyindex UI setup completed");
      } catch (error) {
        console.error("Error during fancyindex UI setup:", error);
      }
    })
    .catch((error) => {
      console.error("Error in fancyindex initialization:", error);
      // Fallback: try to set up UI anyway
      try {
        setupFancyIndexUI();
        setupFancyIndexHeader();
      } catch (fallbackError) {
        console.error("Fallback UI setup also failed:", fallbackError);
      }
    });
}

function setupFancyIndexUI() {
  // Set table class for fancy index
  const list = document.getElementById("list");
  if (!list) return;

  // Only set class if not already set
  if (!list.classList.contains("table")) {
    list.className = "table table-hover";
  }

  // Format dates in file listing only if not already formatted
  const dateCells = list.querySelectorAll("tbody tr td:nth-child(3)");
  dateCells.forEach(function (dateCell) {
    const dateText = dateCell.textContent.trim();

    // Skip if already formatted (contains "-" and ":")
    if (dateText.includes("-") && dateText.includes(":")) {
      return;
    }

    const d = new Date(dateText);
    if (!isNaN(d.getTime())) {
      const dateStr =
        ("000" + d.getFullYear()).substr(-4) +
        "-" +
        ("0" + (d.getMonth() + 1)).substr(-2) +
        "-" +
        ("0" + d.getDate()).substr(-2) +
        (" " +
          ("0" + d.getHours()).substr(-2) +
          ":" +
          ("0" + d.getMinutes()).substr(-2));
      dateCell.textContent = dateStr;
    }
  });
}

function setupFancyIndexHeader() {
  const pathElement = document.getElementById("path");
  if (!pathElement) return;

  const currentPath = pathElement.textContent;
  const pathParts = currentPath.split("/").filter((part) => part.length > 0);

  // Try to get mirror info if this is a mirror path
  if (pathParts.length > 0) {
    const mirrorName = pathParts[0];
    displayMirrorInfo(mirrorName, currentPath);
  }
}

function displayMirrorInfo(mirrorName, currentPath) {
  // Get DOM elements
  const mirrorUpdateInfo = document.getElementById("mirror-update-info");
  const mirrorLastUpdate = document.getElementById("mirror-last-update");
  const mirrorStatusBadge = document.getElementById("mirror-status-badge");

  if (!mirrorUpdateInfo || !mirrorLastUpdate || !mirrorStatusBadge) return;

  // Use existing data if available, otherwise fetch
  if (window.mirrorsData && window.mirrorsData.length > 0) {
    // Guard: skip null/missing-name entries so toLowerCase() never throws.
    const mirrorData = window.mirrorsData.find(
      (m) => isValidMirror(m) && m.name.toLowerCase() === mirrorName.toLowerCase()
    );

    if (mirrorData) {
      updateMirrorHeader(
        mirrorData,
        mirrorUpdateInfo,
        mirrorLastUpdate,
        mirrorStatusBadge
      );
    }
  }
}

function updateMirrorHeader(
  mirrorData,
  infoContainer,
  lastUpdateElement,
  statusBadge
) {
  // Show the info container
  infoContainer.style.display = "block";

  // Update last update time
  if (mirrorData.last_update_ts && mirrorData.last_update_ts > 0) {
    const lastUpdate = new Date(mirrorData.last_update_ts * 1000);
    lastUpdateElement.textContent = lastUpdate.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } else {
    lastUpdateElement.textContent = "未知";
  }

  // Update status badge
  if (mirrorData.status) {
    statusBadge.textContent = mirrorData.status;
    statusBadge.style.display = "inline";

    // Set appropriate status class
    statusBadge.className = "label label-status hidden-xs";
    if (mirrorData.status === "success") {
      statusBadge.classList.add("label-success");
    } else if (mirrorData.status === "syncing") {
      statusBadge.classList.add("label-warning");
    } else if (mirrorData.status === "fail") {
      statusBadge.classList.add("label-danger");
    } else if (mirrorData.status === "paused") {
      statusBadge.classList.add("label-info");
    } else {
      statusBadge.classList.add("label-default");
    }
  } else {
    statusBadge.style.display = "none";
  }
}

// FancyIndex.js functions
function generateBreadcrumb() {
  const pathElement = document.getElementById("path");
  const breadcrumbNav = document.getElementById("breadcrumb-nav");

  if (!breadcrumbNav || !pathElement) return;

  const path = pathElement.textContent;
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

function generateMirrorCard() {
  const pathElement = document.getElementById("path");
  const mirrorCardContainer = document.getElementById("now-browsing-mirror");

  if (!mirrorCardContainer || !pathElement) return;

  const path = pathElement.textContent;
  const pathParts = path.split("/").filter((part) => part.length > 0);
  if (pathParts.length === 0) return;

  const mirrorName = pathParts[0];

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
}

function formatTimestamps() {
  const listTable = document.getElementById("list");
  if (!listTable) return;

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
}

function addFileIcons() {
  const listTable = document.getElementById("list");
  if (!listTable) return;

  const nameLinks = listTable.querySelectorAll("tbody tr td:first-child a");
  nameLinks.forEach((link) => {
    // 检查是否已经有图标了
    if (link.querySelector("i")) return;

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
          icon.className = "fas fa-file-alt";
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

// Make functions globally available
window.generateBreadcrumb = generateBreadcrumb;
window.generateMirrorCard = generateMirrorCard;

// ISO related functions
function loadIsoInfo() {
  loadIsoInfoModal();
}

async function loadIsoInfoModal() {
  const modalBody = document.getElementById("iso-modal-body");
  if (!modalBody) return;
  modalBody.innerHTML =
    '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">正在加载...</span></div><p class="mt-2 text-muted">正在加载...</p></div>';
  try {
    const res = await fetch("/static/isoinfo.json?_=" + Date.now());
    if (!res.ok) throw new Error("ISO 镜像信息加载失败");
    const data = await res.json();
    renderIsoCardsModal(data);
  } catch (e) {
    modalBody.innerHTML =
      '<div class="alert alert-warning">ISO 镜像信息加载失败</div>';
  }
}

// FancyIndex initialization with retry mechanism
function initializeFancyIndexWithRetry() {
  let retryCount = 0;
  const maxRetries = 3; // Reduced retries
  const baseDelay = 300; // Increased base delay

  function attemptInitialization() {
    console.log(`FancyIndex attempt ${retryCount + 1}`);

    const pathElement = document.getElementById("path");
    const listElement = document.getElementById("list");

    if (pathElement && listElement) {
      console.log("FancyIndex elements available, proceeding");

      // Initialize main fancyindex functionality
      try {
        initializeFancyIndex();

        // Add UI enhancements after a delay
        setTimeout(() => {
          try {
            generateBreadcrumb();
            generateMirrorCard();
            formatTimestamps();
            addFileIcons();
            console.log("FancyIndex UI enhancements completed");
          } catch (error) {
            console.error("Error in UI enhancements:", error);
          }
        }, 200);

        return true;
      } catch (error) {
        console.error("Error in main fancyindex initialization:", error);
        return false;
      }
    }

    return false;
  }

  function retryInitialization() {
    if (attemptInitialization()) {
      console.log("FancyIndex initialized successfully");
      return;
    }

    retryCount++;
    if (retryCount < maxRetries) {
      const delay = baseDelay * retryCount;
      console.log(`FancyIndex retry ${retryCount} in ${delay}ms`);
      setTimeout(retryInitialization, delay);
    } else {
      console.log("FancyIndex initialization failed, trying basic setup");
      // Fallback: basic UI setup only
      try {
        setupFancyIndexUI();
        generateBreadcrumb();
        generateMirrorCard();
      } catch (error) {
        console.error("Even basic setup failed:", error);
      }
    }
  }

  // Try immediate initialization first
  if (!attemptInitialization()) {
    retryInitialization();
  }
}

// Page initialization
document.addEventListener("DOMContentLoaded", function () {
  try {
    console.log("Main.js DOMContentLoaded fired");

    // Initialize mirror table on index pages
    if (document.getElementById("mirror-table-body")) {
      console.log("Initializing mirror table");
      try {
        loadMirrorData();
      } catch (error) {
        console.error("Error loading mirror data:", error);
      }
    }

    // Initialize fancyindex if we're on a directory listing page
    const pathElement = document.getElementById("path");
    const listElement = document.getElementById("list");

    if (pathElement && listElement) {
      console.log("Fancyindex elements found, starting initialization");

      // Set up basic styling immediately
      try {
        if (!listElement.classList.contains("table")) {
          listElement.className = "table table-hover";
        }
      } catch (error) {
        console.error("Error setting table classes:", error);
      }

      // Try initialization with fallback
      try {
        initializeFancyIndexWithRetry();
      } catch (error) {
        console.error("Error in fancyindex initialization:", error);
        // Fallback: basic setup
        setTimeout(() => {
          try {
            setupFancyIndexUI();
            generateBreadcrumb();
            generateMirrorCard();
            formatTimestamps();
            addFileIcons();
          } catch (fallbackError) {
            console.error("Error in fallback setup:", fallbackError);
          }
        }, 1000);
      }
    }

    // ISO modal functionality
    const showIsoBtn = document.getElementById("show-iso-list");
    if (showIsoBtn) {
      let modalElement = null;
      let currentModal = null;

      showIsoBtn.addEventListener("click", function () {
        try {
          loadIsoInfoModal();

          modalElement = document.getElementById("isoModal");

          // 清理之前的模态框实例（如果存在）
          if (currentModal) {
            currentModal.dispose();
          }

          currentModal = createSafeModal(modalElement);

          if (currentModal && modalElement) {
            // 添加一次性事件监听器
            const handleModalHidden = function () {
              // 模态框关闭后，将焦点返回到触发按钮
              setTimeout(() => {
                showIsoBtn.focus();
              }, 100);

              // 清理事件监听器
              modalElement.removeEventListener(
                "hidden.bs.modal",
                handleModalHidden
              );
              modalElement.removeEventListener(
                "shown.bs.modal",
                handleModalShown
              );
            };

            const handleModalShown = function () {
              // 模态框显示后，确保有合适的焦点
              const closeBtn = modalElement.querySelector(".btn-close");
              if (closeBtn) {
                closeBtn.focus();
              }
            };

            modalElement.addEventListener("hidden.bs.modal", handleModalHidden);
            modalElement.addEventListener("shown.bs.modal", handleModalShown);

            currentModal.show();
          } else {
            console.error("Failed to create ISO modal");
          }
        } catch (error) {
          console.error("Error opening ISO modal:", error);
        }
      });
    }

    // Header scroll behavior is handled by header.js
  } catch (globalError) {
    console.error("Global error in DOMContentLoaded:", globalError);
  }
});

function renderIsoCardsModal(data) {
  const container = document.getElementById("iso-modal-body");
  if (!container) return;
  const categories = Array.from(new Set(data.map((item) => item.category)));
  const grouped = {};
  categories.forEach((cat) => (grouped[cat] = []));
  data.forEach((item) => {
    if (grouped[item.category]) grouped[item.category].push(item);
  });
  let currentTab =
    categories.find((cat) => grouped[cat].length > 0) || categories[0];
  let currentGroup = grouped[currentTab][0]?.distro || "";

  function render() {
    let tabHtml = `<ul class="nav nav-tabs mb-3">`;
    categories.forEach((cat) => {
      if (grouped[cat].length === 0) return;
      tabHtml += `<li class="nav-item"><a class="nav-link${
        currentTab === cat ? " active" : ""
      }" href="#" data-tab="${cat}">${cat}</a></li>`;
    });
    tabHtml += `</ul>`;
    let groupHtml = `<ul class="nav nav-pills flex-column">`;
    grouped[currentTab].forEach((item) => {
      groupHtml += `<li class="nav-item"><a href="#" class="nav-link${
        currentGroup === item.distro ? " active" : ""
      }" data-group="${item.distro}">${item.distro}</a></li>`;
    });
    groupHtml += `</ul>`;
    const groupData = grouped[currentTab].find(
      (item) => item.distro === currentGroup
    );
    let listHtml = groupData
      ? `<h3>${groupData.distro}</h3><ul>` +
        groupData.urls
          .map(
            (u) => `<li><a href="${u.url}" target="_blank">${u.name}</a></li>`
          )
          .join("") +
        `</ul>`
      : "<div class='text-muted'>暂无数据</div>";
    container.innerHTML = `
      <div class="row">
        <div class="col-lg-12">${tabHtml}</div>
        <div class="col-lg-3">${groupHtml}</div>
        <div class="col-lg-9">${listHtml}</div>
      </div>
    `;
    container.querySelectorAll("[data-tab]").forEach((el) => {
      el.onclick = (e) => {
        e.preventDefault();
        currentTab = el.getAttribute("data-tab");
        currentGroup = grouped[currentTab][0]?.distro || "";
        render();
      };
    });
    container.querySelectorAll("[data-group]").forEach((el) => {
      el.onclick = (e) => {
        e.preventDefault();
        currentGroup = el.getAttribute("data-group");
        render();
      };
    });
  }
  render();
}

function showIsoDetailModal(data) {
  const modalBody = document.getElementById("iso-modal-body");
  if (!modalBody) return;
  const { url, name, sha256 } = data;
  modalBody.innerHTML = `
    <div class="mb-3">
      <a href="${url}" class="btn btn-success" target="_blank"><i class="fas fa-download"></i> 直接下载 ${name}</a>
      <button class="btn btn-outline-secondary ms-2" id="copy-iso-link"><i class="fas fa-copy"></i> 复制下载链接</button>
    </div>
    ${
      sha256
        ? `<div class="mb-2"><strong>SHA256：</strong><span id="iso-sha256">${sha256}</span> <button class="btn btn-outline-secondary btn-sm ms-2" id="copy-iso-sha"><i class="fas fa-copy"></i> 复制校验值</button></div>`
        : ""
    }
    <button class="btn btn-link mt-3" id="back-iso-list"><i class="fas fa-arrow-left"></i> 返回镜像列表</button>
  `;
  document.getElementById("copy-iso-link").onclick = function () {
    copyToClipboard(url);
  };
  if (sha256) {
    document.getElementById("copy-iso-sha").onclick = function () {
      copyToClipboard(sha256);
    };
  }
  document.getElementById("back-iso-list").onclick = function () {
    loadIsoInfoModal();
  };
}

} // end of idempotent guard
