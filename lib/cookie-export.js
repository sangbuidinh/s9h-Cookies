import { downloadTextFile, getAllCookies, getCookiesForCurrentTab, getCookiesForDomain } from "./cookie-api.js";
import { exportCookiesAsHeaderString } from "./format-header.js";
import { exportCookiesAsJson } from "./format-json.js";
import { exportCookiesAsNetscape } from "./format-netscape.js";
import { sanitizeFilenamePart, timestampForFilename } from "./utils.js";

export async function loadCookiesForSource(source, domain, includeSubdomains) {
  if (source === "current") {
    const result = await getCookiesForCurrentTab(includeSubdomains);
    return {
      source: "current",
      label: result.hostname,
      cookies: result.cookies,
      warning: ""
    };
  }

  if (source === "domain") {
    return {
      source: "domain",
      label: domain,
      cookies: await getCookiesForDomain(domain, includeSubdomains),
      warning: ""
    };
  }

  if (source === "all") {
    return {
      source: "all",
      label: "all",
      cookies: await getAllCookies(),
      warning: "Xuất toàn bộ cookie có thể chứa dữ liệu rất nhạy cảm."
    };
  }

  throw new Error("Nguồn xuất cookie không hợp lệ.");
}

export function formatCookiesForExport(cookies, format) {
  if (format === "netscape") {
    return exportCookiesAsNetscape(cookies);
  }
  if (format === "json") {
    return exportCookiesAsJson(cookies);
  }
  if (format === "header") {
    return exportCookiesAsHeaderString(cookies);
  }
  throw new Error("Định dạng xuất không hợp lệ.");
}

function contextFilenamePart(context) {
  const value = context || {};
  const source = sanitizeFilenamePart(value.source || "");
  if (source === "all") {
    return "all";
  }

  const label = sanitizeFilenamePart(value.label || "").slice(0, 32);
  if (source && label) {
    return source + "_" + label;
  }
  return source || label;
}

export function filenameForFormat(format, context) {
  const stamp = timestampForFilename(new Date());
  const contextPart = contextFilenamePart(context);
  const prefix = ["cookies", stamp, contextPart].filter(Boolean).join("_");
  if (format === "json") {
    return prefix + "_json.json";
  }
  if (format === "header") {
    return prefix + "_header.txt";
  }
  return prefix + "_netscape.txt";
}

export function mimeForFormat(format) {
  return format === "json" ? "application/json" : "text/plain";
}

export async function downloadExportText(text, format, context) {
  await downloadTextFile(text, filenameForFormat(format, context), mimeForFormat(format));
}
