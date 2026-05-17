import { removeCookiesForDomain, setBrowserCookie } from "./cookie-api.js";
import { parseHeaderStringCookies } from "./format-header.js";
import { parseJsonCookies } from "./format-json.js";
import { parseNetscapeCookies } from "./format-netscape.js";
import { normalizeDomainInput, stripLeadingDot } from "./utils.js";
import { validateCookieForImport } from "./validator.js";

export function detectImportFormat(text) {
  const value = String(text || "").trim();
  if (!value) {
    throw new Error("Chưa có dữ liệu cookie.");
  }

  if (value.startsWith("[") || value.startsWith("{")) {
    try {
      JSON.parse(value);
      return "json";
    } catch (error) {
      // Continue with other local format checks.
    }
  }

  const lines = value.split(/\r?\n/).filter(function (line) {
    const trimmed = line.trim();
    return trimmed && (!trimmed.startsWith("#") || trimmed.startsWith("#HttpOnly_"));
  });

  if (/Netscape HTTP Cookie File/i.test(value) || lines.some(function (line) {
    return line.split("\t").length >= 7;
  })) {
    return "netscape";
  }

  if (/[^=;\s]+=[^;]*(;\s*[^=;\s]+=[^;]*)*/.test(value)) {
    return "header";
  }

  throw new Error("Không nhận diện được định dạng cookie. Hãy kiểm tra dữ liệu đã dán.");
}

function parseByFormat(text, format, targetDomain) {
  if (format === "json") {
    return parseJsonCookies(text);
  }
  if (format === "netscape") {
    return parseNetscapeCookies(text);
  }
  if (format === "header") {
    return parseHeaderStringCookies(text, targetDomain);
  }
  throw new Error("Định dạng nhập không hợp lệ.");
}

export function parseImportText(text, mode, targetDomain) {
  const format = mode === "auto" ? detectImportFormat(text) : mode;
  const target = normalizeDomainInput(targetDomain || "");

  if (format === "header" && !target) {
    throw new Error("Header String cần có tên miền đích trước khi nhập cookie.");
  }

  const parsed = parseByFormat(text, format, target || targetDomain);
  const records = [];

  for (const parseError of parsed.errors || []) {
    records.push({
      index: parseError.index,
      raw: null,
      cookie: null,
      valid: false,
      status: "failed",
      reason: parseError.reason
    });
  }

  for (const rawCookie of parsed.cookies || []) {
    const validation = validateCookieForImport(rawCookie, { targetDomain: target });
    records.push({
      index: rawCookie.sourceIndex || records.length + 1,
      raw: rawCookie,
      cookie: validation.cookie,
      valid: validation.valid,
      status: validation.valid ? "skipped" : "failed",
      reason: validation.valid ? "Cookie hợp lệ, sẵn sàng nhập." : validation.reason,
      warnings: validation.warnings
    });
  }

  records.sort(function (a, b) {
    return Number(a.index || 0) - Number(b.index || 0);
  });

  return {
    format: format,
    records: records,
    validCookies: records.filter(function (record) {
      return record.valid;
    }).map(function (record) {
      return record.cookie;
    })
  };
}

function affectedDomains(records) {
  const domains = new Set();
  for (const record of records) {
    if (record.valid && record.cookie && record.cookie.domain) {
      domains.add(stripLeadingDot(record.cookie.domain));
    }
  }
  return Array.from(domains).filter(Boolean);
}

function resultForRecord(record, status, reason) {
  const cookie = record.cookie || record.raw || {};
  return {
    index: record.index || "",
    name: cookie.name || "",
    domain: cookie.domain || "",
    status: status,
    reason: reason
  };
}

export async function importCookieRecords(records, mode, overwriteAcknowledged) {
  const results = [];
  const list = records || [];

  if (mode === "dryRun") {
    for (const record of list) {
      if (record.valid) {
        results.push(resultForRecord(record, "skipped", "Chỉ chạy thử, chưa nhập thật."));
      } else {
        results.push(resultForRecord(record, "failed", record.reason || "Cookie không hợp lệ."));
      }
    }
    return results;
  }

  if (mode === "overwrite") {
    if (!overwriteAcknowledged) {
      throw new Error("Bạn cần xác nhận trước khi xóa cookie cũ của tên miền.");
    }

    const domains = affectedDomains(list);
    for (const domain of domains) {
      const removed = await removeCookiesForDomain(domain, false);
      results.push({
        index: "-",
        name: "(overwrite)",
        domain: domain,
        status: "success",
        reason: "Đã xóa " + removed + " cookie cũ của tên miền này."
      });
    }
  }

  for (const record of list) {
    if (!record.valid) {
      results.push(resultForRecord(record, "failed", record.reason || "Cookie không hợp lệ."));
      continue;
    }

    try {
      const saved = await setBrowserCookie(record.cookie);
      if (saved) {
        results.push(resultForRecord(record, "success", "Đã nhập cookie thành công."));
      } else {
        results.push(resultForRecord(record, "failed", "Trình duyệt không trả về cookie đã lưu."));
      }
    } catch (error) {
      results.push(resultForRecord(record, "failed", error.message || "Không nhập được cookie."));
    }
  }

  return results;
}
