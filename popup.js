import { downloadExportText, formatCookiesForExport, loadCookiesForSource } from "./lib/cookie-export.js";
import { importCookieRecords, parseImportText } from "./lib/cookie-import.js";
import { boolText, copyTextToClipboard, formatExpiry, maskCookieValue, setTextContent } from "./lib/utils.js";

const state = {
  exportCookies: [],
  exportText: "",
  importRecords: []
};

const TABLE_NOWRAP = true;

const elements = {
  statusBar: document.getElementById("statusBar"),
  exportTabButton: document.getElementById("exportTabButton"),
  importTabButton: document.getElementById("importTabButton"),
  exportPanel: document.getElementById("exportPanel"),
  importPanel: document.getElementById("importPanel"),
  exportSource: document.getElementById("exportSource"),
  exportDomain: document.getElementById("exportDomain"),
  exportFormat: document.getElementById("exportFormat"),
  includeSubdomains: document.getElementById("includeSubdomains"),
  showExportValues: document.getElementById("showExportValues"),
  allCookiesWarning: document.getElementById("allCookiesWarning"),
  headerExportWarning: document.getElementById("headerExportWarning"),
  copyExportButton: document.getElementById("copyExportButton"),
  downloadExportButton: document.getElementById("downloadExportButton"),
  exportCount: document.getElementById("exportCount"),
  exportPreviewDetails: document.getElementById("exportPreviewDetails"),
  exportTable: document.getElementById("exportTable"),
  importFile: document.getElementById("importFile"),
  targetDomain: document.getElementById("targetDomain"),
  importMode: document.getElementById("importMode"),
  overwriteWarning: document.getElementById("overwriteWarning"),
  overwriteAck: document.getElementById("overwriteAck"),
  showImportValues: document.getElementById("showImportValues"),
  importText: document.getElementById("importText"),
  importCookiesButton: document.getElementById("importCookiesButton"),
  clearImportButton: document.getElementById("clearImportButton"),
  importCount: document.getElementById("importCount"),
  importPreviewDetails: document.getElementById("importPreviewDetails"),
  importTable: document.getElementById("importTable"),
  resultSection: document.getElementById("resultSection"),
  resultTable: document.getElementById("resultTable")
};

function displayFormat(format) {
  if (format === "netscape") {
    return "Netscape";
  }
  if (format === "json") {
    return "JSON";
  }
  if (format === "header") {
    return "Header String";
  }
  return format;
}

function displayResultStatus(status) {
  if (status === "success") {
    return "thành công";
  }
  if (status === "skipped") {
    return "bỏ qua";
  }
  if (status === "failed") {
    return "lỗi";
  }
  return status;
}

function setStatus(message, type) {
  setTextContent(elements.statusBar, message);
  elements.statusBar.classList.remove("error", "success");
  if (type) {
    elements.statusBar.classList.add(type);
  }
}

function setBusy(isBusy) {
  [
    elements.copyExportButton,
    elements.downloadExportButton,
    elements.importCookiesButton,
    elements.clearImportButton
  ].filter(Boolean).forEach(function (button) {
    button.disabled = isBusy;
  });
}

function addListener(element, eventName, handler) {
  if (element) {
    element.addEventListener(eventName, handler);
  }
}

function activateTab(tabName) {
  const exportActive = tabName === "export";
  elements.exportPanel.classList.toggle("active", exportActive);
  elements.importPanel.classList.toggle("active", !exportActive);
  elements.exportTabButton.classList.toggle("active", exportActive);
  elements.importTabButton.classList.toggle("active", !exportActive);
  elements.exportTabButton.setAttribute("aria-selected", String(exportActive));
  elements.importTabButton.setAttribute("aria-selected", String(!exportActive));
}

function tableBody(table) {
  return table.querySelector("tbody");
}

function clearTable(table, message, columnCount) {
  const body = tableBody(table);
  body.textContent = "";
  const row = document.createElement("tr");
  row.className = "empty-row";
  const cell = document.createElement("td");
  cell.colSpan = columnCount;
  cell.textContent = message;
  row.appendChild(cell);
  body.appendChild(row);
}

function appendCell(row, value, className) {
  const cell = document.createElement("td");
  cell.textContent = value === undefined || value === null ? "" : String(value);
  if (className) {
    cell.className = className;
  }
  row.appendChild(cell);
}

function renderCookieTable(table, cookies, showValues, nowrap) {
  table.classList.toggle("nowrap", Boolean(nowrap));
  const body = tableBody(table);
  body.textContent = "";

  if (!cookies.length) {
    clearTable(table, "Không có cookie để hiển thị.", 8);
    return;
  }

  for (const cookie of cookies) {
    const row = document.createElement("tr");
    appendCell(row, cookie.domain);
    appendCell(row, cookie.path || "/");
    appendCell(row, boolText(Boolean(cookie.secure)));
    appendCell(row, boolText(Boolean(cookie.httpOnly)));
    appendCell(row, cookie.sameSite || "");
    appendCell(row, formatExpiry(cookie.expirationDate, cookie.session));
    appendCell(row, cookie.name);
    appendCell(row, showValues ? cookie.value : maskCookieValue(cookie.value));
    body.appendChild(row);
  }
}

function setResultSectionVisible(visible) {
  if (elements.resultSection) {
    elements.resultSection.classList.toggle("hidden", !visible);
  }
}

function renderResultTable(results) {
  const body = tableBody(elements.resultTable);
  body.textContent = "";

  if (!results.length) {
    setResultSectionVisible(false);
    return;
  }

  setResultSectionVisible(true);

  for (const result of results) {
    const row = document.createElement("tr");
    appendCell(row, result.index);
    appendCell(row, result.name);
    appendCell(row, result.domain);
    appendCell(row, displayResultStatus(result.status), "status-" + result.status);
    appendCell(row, result.reason);
    body.appendChild(row);
  }
}

function getSelectedImportMode() {
  return elements.importMode.value || "dryRun";
}

function updateImportModeControls() {
  const isOverwrite = getSelectedImportMode() === "overwrite";
  elements.overwriteWarning.classList.toggle("hidden", !isOverwrite);
  elements.overwriteAck.disabled = !isOverwrite;
  if (!isOverwrite) {
    elements.overwriteAck.checked = false;
  }
}

function updateExportControls() {
  const source = elements.exportSource.value;
  let format = elements.exportFormat.value;
  const headerOption = Array.from(elements.exportFormat.options).find(function (option) {
    return option.value === "header";
  });

  if (headerOption) {
    headerOption.disabled = source === "all";
  }

  if (source === "all" && format === "header") {
    elements.exportFormat.value = "netscape";
    format = elements.exportFormat.value;
    setStatus("Header String không phù hợp khi xuất tất cả cookie. Đã chuyển sang Netscape cookies.txt.", "error");
  }

  elements.exportDomain.disabled = source !== "domain";
  elements.allCookiesWarning.classList.toggle("hidden", source !== "all");
  elements.headerExportWarning.classList.toggle("hidden", format !== "header");
}

function updateExportText() {
  state.exportText = formatCookiesForExport(state.exportCookies, elements.exportFormat.value);
}

async function refreshExportCookies() {
  updateExportControls();
  const source = elements.exportSource.value;
  const includeRelated = elements.includeSubdomains.checked;
  const result = await loadCookiesForSource(source, elements.exportDomain.value, includeRelated);
  state.exportCookies = result.cookies;
  updateExportText();
  renderCookieTable(elements.exportTable, state.exportCookies, elements.showExportValues.checked, TABLE_NOWRAP);
  elements.exportCount.textContent = state.exportCookies.length + " cookie đã xử lý";
  if (!state.exportCookies.length) {
    throw new Error("Không tìm thấy cookie theo phạm vi đã chọn.");
  }
  return result;
}

async function copyExport() {
  setBusy(true);
  try {
    await refreshExportCookies();
    await copyTextToClipboard(state.exportText);
    setStatus("Đã sao chép " + state.exportCookies.length + " cookie vào clipboard.", "success");
  } catch (error) {
    setStatus(error.message || "Không sao chép được.", "error");
  } finally {
    setBusy(false);
  }
}

async function downloadExport() {
  setBusy(true);
  try {
    await refreshExportCookies();
    await downloadExportText(state.exportText, elements.exportFormat.value);
    setStatus("Đã xuất " + state.exportCookies.length + " cookie và bắt đầu tải xuống.", "success");
  } catch (error) {
    setStatus(error.message || "Không tải xuống được.", "error");
  } finally {
    setBusy(false);
  }
}

function readImportFile(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      resolve(String(reader.result || ""));
    };
    reader.onerror = function () {
      reject(new Error("Không đọc được file đã chọn."));
    };
    reader.readAsText(file);
  });
}

function recordsToCookies(records) {
  return records.filter(function (record) {
    return record.valid && record.cookie;
  }).map(function (record) {
    return record.cookie;
  });
}

function recordsToParseLogs(records) {
  return records.filter(function (record) {
    return !record.valid;
  }).map(function (record) {
    const cookie = record.cookie || record.raw || {};
    return {
      index: record.index || "",
      name: cookie.name || "",
      domain: cookie.domain || "",
      status: "failed",
      reason: record.reason || "Cookie không hợp lệ."
    };
  });
}

function parseImportData() {
  try {
    const parsed = parseImportText(elements.importText.value, "auto", elements.targetDomain.value);
    state.importRecords = parsed.records;
    const validCookies = recordsToCookies(state.importRecords);
    renderCookieTable(elements.importTable, validCookies, elements.showImportValues.checked, TABLE_NOWRAP);
    renderResultTable(recordsToParseLogs(state.importRecords));
    elements.importCount.textContent = validCookies.length + " cookie hợp lệ / " + state.importRecords.length + " cookie đã xử lý";
    return parsed;
  } catch (error) {
    state.importRecords = [];
    renderCookieTable(elements.importTable, [], false, TABLE_NOWRAP);
    renderResultTable([{
      index: "-",
      name: "",
      domain: "",
      status: "failed",
      reason: error.message || "Không xử lý được dữ liệu cookie."
    }]);
    elements.importCount.textContent = "0 cookie đã xử lý";
    setStatus(error.message || "Không xử lý được dữ liệu cookie.", "error");
    return null;
  }
}

async function importCookies() {
  setBusy(true);
  try {
    const parsed = parseImportData();
    if (!parsed) {
      return;
    }
    if (!state.importRecords.length) {
      setStatus("Sẵn sàng nhập cookie.", "success");
      return;
    }
    const mode = getSelectedImportMode();
    const results = await importCookieRecords(state.importRecords, mode, elements.overwriteAck.checked);
    renderResultTable(results);
    const validCount = recordsToCookies(state.importRecords).length;
    const successCount = results.filter(function (result) {
      return result.status === "success";
    }).length;
    const failedCount = results.filter(function (result) {
      return result.status === "failed";
    }).length;
    const skippedCount = results.filter(function (result) {
      return result.status === "skipped";
    }).length;
    elements.importCount.textContent = validCount + " cookie hợp lệ / " + state.importRecords.length + " cookie đã xử lý";
    const statusType = failedCount ? "error" : "success";
    setStatus("Nhật ký nhập: " + successCount + " thành công, " + skippedCount + " bỏ qua, " + failedCount + " lỗi.", statusType);
  } catch (error) {
    setStatus(error.message || "Nhập cookie thất bại.", "error");
  } finally {
    setBusy(false);
  }
}

function clearImport() {
  elements.importFile.value = "";
  elements.importText.value = "";
  elements.targetDomain.value = "";
  elements.importMode.value = "dryRun";
  elements.overwriteAck.checked = false;
  updateImportModeControls();
  state.importRecords = [];
  renderCookieTable(elements.importTable, [], false, TABLE_NOWRAP);
  renderResultTable([]);
  setResultSectionVisible(false);
  elements.importCount.textContent = "0 cookie đã xử lý";
  setStatus("Đã xóa ô nhập.");
}

addListener(elements.exportTabButton, "click", function () {
  activateTab("export");
});

addListener(elements.importTabButton, "click", function () {
  activateTab("import");
});

addListener(elements.exportSource, "change", function () {
  state.exportCookies = [];
  state.exportText = "";
  elements.exportCount.textContent = "0 cookie";
  renderCookieTable(elements.exportTable, [], false, TABLE_NOWRAP);
  updateExportControls();
});
addListener(elements.exportFormat, "change", function () {
  updateExportControls();
  if (state.exportCookies.length) {
    updateExportText();
  }
});

addListener(elements.showExportValues, "change", function () {
  renderCookieTable(elements.exportTable, state.exportCookies, elements.showExportValues.checked, TABLE_NOWRAP);
});

addListener(elements.copyExportButton, "click", copyExport);
addListener(elements.downloadExportButton, "click", downloadExport);

addListener(elements.importFile, "change", async function () {
  const file = elements.importFile.files && elements.importFile.files[0];
  if (!file) {
    return;
  }

  try {
    elements.importText.value = await readImportFile(file);
    setStatus("Đã tải nội dung file vào ô dữ liệu cookie.", "success");
  } catch (error) {
    setStatus(error.message || "Không đọc được file.", "error");
  }
});

addListener(elements.importCookiesButton, "click", importCookies);
addListener(elements.clearImportButton, "click", clearImport);

addListener(elements.importMode, "change", updateImportModeControls);

addListener(elements.showImportValues, "change", function () {
  renderCookieTable(elements.importTable, recordsToCookies(state.importRecords), elements.showImportValues.checked, TABLE_NOWRAP);
});

if (elements.importMode) {
  elements.importMode.value = "dryRun";
}

updateExportControls();
updateImportModeControls();
renderCookieTable(elements.exportTable, [], false, TABLE_NOWRAP);
renderCookieTable(elements.importTable, [], false, TABLE_NOWRAP);
renderResultTable([]);
