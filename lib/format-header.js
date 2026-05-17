import { sortCookies } from "./utils.js";

export function exportCookiesAsHeaderString(cookies) {
  return sortCookies(cookies).map(function (cookie) {
    return String(cookie.name || "") + "=" + String(cookie.value || "");
  }).join("; ");
}

export function parseHeaderStringCookies(text, targetDomain) {
  const domain = String(targetDomain || "").trim();
  if (!domain) {
    throw new Error("Header String cần có tên miền đích trước khi nhập cookie.");
  }

  const isHttpUrl = /^http:\/\//i.test(domain);
  const pairs = String(text || "").split(";");
  const cookies = [];
  const errors = [];

  pairs.forEach(function (pair, index) {
    const trimmed = pair.trim();
    if (!trimmed) {
      return;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      errors.push({
        index: index + 1,
        name: "",
        domain: domain,
        status: "failed",
        reason: "Cặp cookie trong Header String phải có dạng name=value."
      });
      return;
    }

    cookies.push({
      domain: domain,
      hostOnly: !domain.startsWith("."),
      path: "/",
      secure: !isHttpUrl,
      httpOnly: false,
      sameSite: "unspecified",
      session: true,
      expirationDate: 0,
      name: trimmed.slice(0, equalsIndex).trim(),
      value: trimmed.slice(equalsIndex + 1),
      sourceIndex: index + 1
    });
  });

  return { cookies: cookies, errors: errors };
}
