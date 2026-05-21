// Handles all logic for the mirror status page.
// Wrapped in an IIFE so `let` declarations stay local and don't collide
// with main.js's global `var mirrorDescriptions` etc. (which would raise
// "Identifier already declared" at parse time).
(function () {
"use strict";

let statusData = [];
let diskData = [];
let mirrorDescriptions = {};
let newMirrors = [];
let unlistedMirrors = [];
let forceRedirectHelpMirrors = [];
let labelMap = {};
let autoRefreshInterval;
let diskInfoRendered = false;

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

// Load mirror description data from options.json (tuna-style layout)
async function loadMirrorDescriptions() {
  try {
    const response = await fetch("/static/options.json?_=" + Date.now());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const opts = (data && data.options) || {};

    if (Array.isArray(opts.mirror_desc)) {
      opts.mirror_desc.forEach((item) => {
        if (item && item.name) mirrorDescriptions[item.name] = item.desc;
      });
      console.log("Status page: Loaded mirror descriptions:", Object.keys(mirrorDescriptions).length);
    }

    if (Array.isArray(opts.new_mirrors)) {
      newMirrors = opts.new_mirrors;
      console.log("Status page: Loaded new mirrors:", newMirrors.length);
    }

    if (Array.isArray(opts.unlisted_mirrors)) {
      unlistedMirrors = opts.unlisted_mirrors;
      console.log("Status page: Loaded extra mirrors:", unlistedMirrors.length);
    }

    if (Array.isArray(opts.force_redirect_help_mirrors)) {
      forceRedirectHelpMirrors = opts.force_redirect_help_mirrors;
      console.log("Status page: Loaded force redirect mirrors:", forceRedirectHelpMirrors.length);
    }

    if (opts.label_map && typeof opts.label_map === "object") {
      labelMap = opts.label_map;
      console.log("Status page: Loaded label map:", Object.keys(labelMap).length);
    }
  } catch (error) {
    console.error("Status page: Failed to load options.json:", error);
    mirrorDescriptions = {};
    newMirrors = [];
    unlistedMirrors = [];
    forceRedirectHelpMirrors = [];
    labelMap = {};
  }
}

// Get mirror description
function getMirrorDescription(mirrorName) {
  return (
    mirrorDescriptions[mirrorName] ||
    `${mirrorName} open source software mirror`
  );
}

// Check if a mirror is new
function isNewMirror(mirrorName) {
  return newMirrors.includes(mirrorName);
}

// Get the badge for a new mirror
function getNewMirrorBadge(mirrorName) {
  if (isNewMirror(mirrorName)) {
    return '<span class="badge bg-warning text-dark ms-2"><i class="fas fa-star me-1"></i>New Mirror</span>';
  }
  return "";
}

// Check if a mirror has a help page
function hasHelpPage(mirrorName) {
  // This can be expanded to check for the actual existence of a help page
  return true;
}

// Get the URL for a mirror's help page
function getMirrorHelpUrl(mirrorName) {
  return `/help/${mirrorName}/`;
}

// Custom sort function for mirrors: uppercase first (A-Z), then lowercase (a-z)
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

// Smartly format storage size
function formatStorageSize(kb) {
  const bytes = kb * 1024;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return size.toFixed(2) + " " + units[unitIndex];
}

// Fetch disk information
async function fetchDiskData() {
  if (diskInfoRendered) return;
  diskInfoRendered = true;
  try {
    const res = await fetch("/static/disk.json?_=" + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();

    if (Array.isArray(data)) {
      diskData = data;
      console.log("Loaded disk data:", diskData.length, "disks");
      renderDiskInfo();
    } else {
      console.error("disk.json format is incorrect:", data);
      diskData = [];
      renderDiskError();
    }
  } catch (e) {
    console.error("Failed to load disk info:", e);
    renderDiskError();
  }
}

// Render disk information
function renderDiskInfo() {
  const diskContainer = document.getElementById("disk-info");
  if (!diskData.length) {
    diskContainer.innerHTML =
      '<div class="text-center small text-muted">No disk data available</div>';
    return;
  }

  let html = "";
  let totalDiskTotal = 0;
  let totalDiskUsed = 0;

  diskData.forEach((disk, index) => {
    const totalFormatted = formatStorageSize(disk.total_kb);
    const usedFormatted = formatStorageSize(disk.used_kb);
    const usagePercent = ((disk.used_kb / disk.total_kb) * 100).toFixed(1);
    const freeFormatted = formatStorageSize(disk.total_kb - disk.used_kb);

    totalDiskTotal += disk.total_kb;
    totalDiskUsed += disk.used_kb;

    let progressBarClass = "bg-success";
    if (usagePercent > 90) {
      progressBarClass = "bg-danger";
    } else if (usagePercent >= 75) {
      progressBarClass = "bg-warning";
    }

    html += `
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="small"><strong>Disk ${
                      index + 1
                    }</strong></span>
                    <span class="small text-muted">${usagePercent}%</span>
                </div>
                <div class="progress mb-2" style="height: 8px;">
                    <div class="progress-bar ${progressBarClass}" role="progressbar" 
                         style="width: ${usagePercent}%; transition: none; animation: none;" aria-valuenow="${usagePercent}" 
                         aria-valuemin="0" aria-valuemax="100"></div>
                </div>
                <div class="small text-muted">
                    <div>Used: ${usedFormatted}</div>
                    <div>Total: ${totalFormatted}</div>
                    <div>Free: ${freeFormatted}</div>
                </div>
            </div>
        `;
  });

  if (diskData.length > 1) {
    const totalFormatted = formatStorageSize(totalDiskTotal);
    const usedFormatted = formatStorageSize(totalDiskUsed);
    const usagePercent = ((totalDiskUsed / totalDiskTotal) * 100).toFixed(1);
    const freeFormatted = formatStorageSize(totalDiskTotal - totalDiskUsed);

    let progressBarClass = "bg-success";
    if (usagePercent > 90) {
      progressBarClass = "bg-danger";
    } else if (usagePercent >= 75) {
      progressBarClass = "bg-warning";
    }

    html += `
            <hr class="my-3">
            <div class="mb-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="small"><strong>Total</strong></span>
                    <span class="small text-muted">${usagePercent}%</span>
                </div>
                <div class="progress mb-2" style="height: 10px;">
                    <div class="progress-bar ${progressBarClass}" role="progressbar" 
                         style="width: ${usagePercent}%; transition: none; animation: none;" aria-valuenow="${usagePercent}" 
                         aria-valuemin="0" aria-valuemax="100"></div>
                </div>
                <div class="small text-muted">
                    <div>Used: ${usedFormatted}</div>
                    <div>Total: ${totalFormatted}</div>
                    <div>Free: ${freeFormatted}</div>
                </div>
            </div>
        `;
  }

  diskContainer.innerHTML = html;
}

function renderDiskError() {
  const diskContainer = document.getElementById("disk-info");
  diskContainer.innerHTML = `
        <div class="text-center small text-danger">
            <i class="fas fa-exclamation-triangle"></i> Failed to load disk info
        </div>
    `;
}

// Fetch tunasync.json
async function fetchStatusData() {
  try {
    const res = await fetch("/static/tunasync.json?_=" + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();

    if (Array.isArray(data)) {
      statusData = filterValidMirrors(data, "tunasync.json");
    } else {
      console.error("tunasync.json format is incorrect:", data);
      statusData = [];
    }

    // Sort after filtering so sortMirrorsByName never sees invalid entries.
    statusData.sort(sortMirrorsByName);

    unlistedMirrors.forEach((unlistedMirror) => {
      // Skip virtual mirrors whose own name is missing/blank.
      if (!isValidMirror(unlistedMirror)) {
        console.warn(
          "[ha-mirrors] Skipping unlisted_mirror with missing/blank name:",
          unlistedMirror
        );
        return;
      }
      const existingMirror = statusData.find(
        (m) => isValidMirror(m) && m.name === unlistedMirror.name
      );
      if (!existingMirror) {
        const linkToMirror = statusData.find(
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
          console.log(
            `Status page: Mirror ${unlistedMirror.name} inherited sync info from ${unlistedMirror.link_to}`
          );
        } else {
          virtualMirror.size = "Unknown";
          virtualMirror.status = "unknown";
          virtualMirror.last_update_ts = 0;
          virtualMirror.next_schedule_ts = 0;
          virtualMirror.last_started_ts = 0;
          virtualMirror.upstream = "";
          console.warn(
            `Status page: Could not find main mirror ${unlistedMirror.link_to} for ${unlistedMirror.name}`
          );
        }

        statusData.push(virtualMirror);
      }
    });

    statusData.sort(sortMirrorsByName);

    // Per user request: classify mirrors with no last update time as 'unknown'
    statusData.forEach((item) => {
      if (!item.last_update_ts || item.last_update_ts <= 0) {
        item.status = "unknown";
      }
    });

    console.log(
      "Loaded mirror data:",
      statusData.length,
      "items (including extra mirrors)"
    );
    renderStatusTable();
    updateSidebarStats();
    updateRefreshTime();
  } catch (e) {
    console.error("Failed to load sync status:", e);
    renderStatusError();
  }
}

// Render the status table
function renderStatusTable() {
  const tbody = document.getElementById("status-table-body");
  // Skip records with missing/blank names to avoid blank mirror rows after build.
  const validData = statusData.filter(isValidMirror);
  if (!validData.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4">No data available</td></tr>`;
    return;
  }

  let html = "";
  validData.forEach((item) => {
    const statusInfo = getStatusInfo(item.status);
    html += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <i class="fas fa-database fa-lg me-3 text-primary"></i>
                        <div>
                            <div class="mirror-name" title="${getMirrorDescription(
                              item.name
                            )}" 
                                 data-bs-toggle="tooltip" data-bs-placement="top">${
                                   item.name || "Unknown"
                                 }${getNewMirrorBadge(item.name)}</div>
                            ${
                              item.upstream
                                ? `<small class="text-muted">${item.upstream}</small>`
                                : ""
                            }
                        </div>
                    </div>
                </td>
                <td style="width: 8%;">
                    <span class="badge ${statusInfo.class}">
                        <i class="${statusInfo.icon}"></i> ${statusInfo.text}
                    </span>
                </td>
                <td class="fs-6" style="width: 15%; white-space: nowrap;">${formatTime(
                  item.last_update_ts
                )}</td>
                <td class="fs-6" style="width: 15%; white-space: nowrap;">${formatTime(
                  item.next_schedule_ts
                )}</td>
                <td class="fs-6" style="width: 15%; white-space: nowrap;">${formatTime(
                  item.last_started_ts
                )}</td>
                <td class="fs-6 mirror-size" style="width: 10%; white-space: nowrap;">${
                  item.size || "-"
                }</td>
            </tr>
        `;
  });
  tbody.innerHTML = html;

  initializeTooltips();
}

// Initialize Bootstrap tooltips
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

function renderStatusError() {
  const tbody = document.getElementById("status-table-body");
  tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-4 text-danger">
                <i class="fas fa-exclamation-triangle fa-2x mb-2"></i><br>
                Failed to load sync status, please try again later.
            </td>
        </tr>
    `;
}

function getStatusInfo(status) {
  switch (status) {
    case "success":
      return {
        class: "bg-success",
        icon: "fas fa-check",
        text: "成功",
      };
    case "syncing":
      return {
        class: "bg-warning",
        icon: "fas fa-sync-alt fa-spin",
        text: "同步中",
      };
    case "failed":
    case "fail":
    case "error":
      return {
        class: "bg-danger",
        icon: "fas fa-times",
        text: "失败",
      };
    case "paused":
      return {
        class: "bg-info",
        icon: "fas fa-pause",
        text: "暂停",
      };
    default: // unknown
      return {
        class: "bg-secondary",
        icon: "fas fa-question",
        text: "未知",
      };
  }
}

function updateSidebarStats() {
  // Use only valid mirror records (name present and non-blank).
  const validData = statusData.filter(isValidMirror);
  const successCount = validData.filter(
    (item) => item.status === "success"
  ).length;
  const syncingCount = validData.filter(
    (item) => item.status === "syncing"
  ).length;
  const failedCount = validData.filter(
    (item) =>
      item.status === "failed" ||
      item.status === "error" ||
      item.status === "fail"
  ).length;
  const pausedCount = validData.filter(
    (item) => item.status === "paused"
  ).length;
  const totalCount = validData.length;
  const unknownCount =
    totalCount - successCount - syncingCount - failedCount - pausedCount;

  document.getElementById("sidebar-success").textContent = successCount;
  document.getElementById("sidebar-syncing").textContent = syncingCount;
  document.getElementById("sidebar-failed").textContent = failedCount;
  document.getElementById("sidebar-paused").textContent = pausedCount;
  document.getElementById("sidebar-unknown").textContent = unknownCount;
  document.getElementById("sidebar-total").textContent = totalCount;
}

function updateRefreshTime() {
  const el = document.getElementById("last-refresh-time");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString("zh-CN");
}

function formatTime(ts) {
  if (!ts || ts <= 0) return "Unknown";
  if (ts < 0) return "No schedule";

  try {
    const date = new Date(ts * 1000);
    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0") +
      " " +
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0")
    );
  } catch (e) {
    return "Unknown";
  }
}

function refreshStatus() {
  fetchStatusData();
}

function setupAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  const checkbox = document.getElementById("auto-refresh");
  // No toggle on the page -> always auto-refresh every 10s.
  if (!checkbox || checkbox.checked) {
    autoRefreshInterval = setInterval(fetchStatusData, 10000);
  }
}

// Initial load
document.addEventListener("DOMContentLoaded", function () {
  loadMirrorDescriptions().then(() => {
    fetchStatusData();
  });
  fetchDiskData();
  const btn = document.getElementById("refresh-status");
  if (btn) btn.addEventListener("click", refreshStatus);
  const toggle = document.getElementById("auto-refresh");
  if (toggle) toggle.addEventListener("change", setupAutoRefresh);
  setupAutoRefresh();
});

})();
