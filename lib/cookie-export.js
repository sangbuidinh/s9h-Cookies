import { downloadTextFile, getAllCookies, getCookiesForCurrentTab, getCookiesForDomain } from "./cookie-api.js";
import { exportCookiesAsHeaderString } from "./format-header.js";
import { exportCookiesAsJson } from "./format-json.js";
import { exportCookiesAsNetscape } from "./format-netscape.js";
import { timestampForFilename } from "./utils.js";

export async function loadCookiesForSource(source, domain, includeSubdomains) {
  if (source === "current") {
    const result = await getCookiesForCurrentTab(includeSubdomains);
    return {
      label: result.hostname,
      cookies: result.cookies,
      warning: ""
    };
  }

  if (source === "domain") {
    return {
      label: domain,
      cookies: await getCookiesForDomain(domain, includeSubdomains),
      warning: ""
    };
  }

  if (source === "all") {
    return {
      label: "tất cả cookie",
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

export function filenameForFormat(format) {
  const stamp = timestampForFilename(new Date());
  if (format === "json") {
    return "cookies_" + stamp + ".json";
  }
  if (format === "header") {
    return "cookies_" + stamp + "_header.txt";
  }
  return "cookies_" + stamp + ".txt";
}

export function mimeForFormat(format) {
  return format === "json" ? "application/json" : "text/plain";
}

export async function downloadExportText(text, format) {
  await downloadTextFile(text, filenameForFormat(format), mimeForFormat(format));
}
