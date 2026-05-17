import { boolText, sortCookies } from "./utils.js";

function expiryForNetscape(cookie) {
  if (cookie.session || !cookie.expirationDate) {
    return "0";
  }
  return String(Math.floor(Number(cookie.expirationDate) || 0));
}

export function exportCookiesAsNetscape(cookies) {
  const lines = [
    "# Netscape HTTP Cookie File",
    "# Được tạo bởi Công cụ Xuất / Nhập Cookie",
    "# File này chỉ xử lý cục bộ. Hãy giữ file ở nơi an toàn."
  ];

  for (const cookie of sortCookies(cookies)) {
    const includeSubdomains = !cookie.hostOnly || String(cookie.domain || "").startsWith(".");
    lines.push([
      cookie.domain || "",
      boolText(includeSubdomains),
      cookie.path || "/",
      boolText(Boolean(cookie.secure)),
      expiryForNetscape(cookie),
      cookie.name || "",
      cookie.value || ""
    ].join("\t"));
  }

  return lines.join("\n") + "\n";
}

export function parseNetscapeCookies(text) {
  const cookies = [];
  const errors = [];
  const lines = String(text || "").split(/\r?\n/);

  lines.forEach(function (rawLine, lineIndex) {
    let line = rawLine.trimEnd();
    if (!line.trim()) {
      return;
    }

    let httpOnly = false;
    if (line.startsWith("#HttpOnly_")) {
      httpOnly = true;
      line = line.slice("#HttpOnly_".length);
    } else if (line.trimStart().startsWith("#")) {
      return;
    }

    const parts = line.split("\t");
    if (parts.length < 7) {
      errors.push({
        index: lineIndex + 1,
        name: "",
        domain: "",
        status: "failed",
        reason: "Dòng Netscape phải có 7 cột phân tách bằng tab."
      });
      return;
    }

    const domain = parts[0];
    const includeSubdomains = String(parts[1]).toUpperCase() === "TRUE";
    const secure = String(parts[3]).toUpperCase() === "TRUE";
    const expirationDate = Number(parts[4]);
    const name = parts[5];
    const value = parts.slice(6).join("\t");

    cookies.push({
      domain: domain,
      hostOnly: !includeSubdomains,
      path: parts[2] || "/",
      secure: secure,
      httpOnly: httpOnly,
      sameSite: "unspecified",
      session: !expirationDate,
      expirationDate: expirationDate || 0,
      name: name,
      value: value,
      sourceIndex: lineIndex + 1
    });
  });

  return { cookies: cookies, errors: errors };
}
