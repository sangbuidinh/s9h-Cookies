import { sortCookies } from "./utils.js";

export function exportCookiesAsJson(cookies) {
  const exported = sortCookies(cookies).map(function (cookie) {
    return {
      domain: cookie.domain || "",
      hostOnly: Boolean(cookie.hostOnly),
      path: cookie.path || "/",
      secure: Boolean(cookie.secure),
      httpOnly: Boolean(cookie.httpOnly),
      sameSite: cookie.sameSite || "unspecified",
      session: Boolean(cookie.session),
      expirationDate: cookie.expirationDate || 0,
      name: cookie.name || "",
      value: cookie.value || ""
    };
  });
  return JSON.stringify(exported, null, 2);
}

export function parseJsonCookies(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text || ""));
  } catch (error) {
    throw new Error("Dữ liệu cookie JSON không hợp lệ.");
  }

  const list = Array.isArray(parsed) ? parsed : [parsed];
  return {
    cookies: list.map(function (cookie, index) {
      return Object.assign({}, cookie, { sourceIndex: index + 1 });
    }),
    errors: []
  };
}
