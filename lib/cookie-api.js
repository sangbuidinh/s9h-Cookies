import {
  domainMatchesTarget,
  ensurePath,
  getDomainCandidates,
  normalizeDomainInput,
  stripLeadingDot,
  uniqueCookies
} from "./utils.js";

function chromeCallback(method, context, args) {
  return new Promise(function (resolve, reject) {
    method.apply(context, args.concat(function (result) {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    }));
  });
}

export async function getCurrentTabHostname() {
  const tabs = await chromeCallback(chrome.tabs.query, chrome.tabs, [{ active: true, currentWindow: true }]);
  const tab = tabs && tabs[0];
  if (!tab || !tab.url) {
    throw new Error("Không lấy được URL của tab hiện tại.");
  }

  let parsed;
  try {
    parsed = new URL(tab.url);
  } catch (error) {
    throw new Error("URL của tab hiện tại không hợp lệ.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Hãy mở trang http hoặc https trước khi xuất từ Tab hiện tại.");
  }

  return parsed.hostname;
}

export { getDomainCandidates };

export async function getAllCookies() {
  return chromeCallback(chrome.cookies.getAll, chrome.cookies, [{}]);
}

export async function getCookiesForDomain(domain, includeRelated) {
  const normalized = normalizeDomainInput(domain);
  if (!normalized) {
    throw new Error("Hãy nhập tên miền hợp lệ.");
  }

  const clean = stripLeadingDot(normalized);
  const candidates = includeRelated ? getDomainCandidates(clean) : [clean, "." + clean];
  const all = [];

  for (const candidate of candidates) {
    const queryDomain = stripLeadingDot(candidate);
    if (!queryDomain) {
      continue;
    }
    try {
      const cookies = await chromeCallback(chrome.cookies.getAll, chrome.cookies, [{ domain: queryDomain }]);
      all.push.apply(all, cookies || []);
    } catch (error) {
      // Continue with other candidates. A later empty result is clearer to the user.
    }
  }

  return uniqueCookies(all).filter(function (cookie) {
    return domainMatchesTarget(cookie.domain, clean, includeRelated);
  });
}

export async function getCookiesForCurrentTab(includeRelated) {
  const hostname = await getCurrentTabHostname();
  const cookies = await getCookiesForDomain(hostname, includeRelated);
  return { hostname: hostname, cookies: cookies };
}

export function buildCookieUrl(cookie) {
  const domain = stripLeadingDot(cookie.domain);
  if (!domain) {
    throw new Error("Cookie bắt buộc phải có tên miền.");
  }
  const scheme = cookie.secure ? "https://" : "http://";
  return scheme + domain + ensurePath(cookie.path);
}

export async function setBrowserCookie(cookie) {
  const details = {
    url: buildCookieUrl(cookie),
    name: String(cookie.name),
    value: String(cookie.value || ""),
    path: ensurePath(cookie.path),
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly)
  };

  if (!cookie.hostOnly) {
    details.domain = cookie.domain;
  }

  if (cookie.sameSite && ["no_restriction", "lax", "strict", "unspecified"].includes(cookie.sameSite)) {
    details.sameSite = cookie.sameSite;
  }

  if (!cookie.session && Number(cookie.expirationDate) > Date.now() / 1000) {
    details.expirationDate = Number(cookie.expirationDate);
  }

  return chromeCallback(chrome.cookies.set, chrome.cookies, [details]);
}

export async function removeBrowserCookie(cookie) {
  const details = {
    url: buildCookieUrl(cookie),
    name: cookie.name
  };
  if (cookie.storeId) {
    details.storeId = cookie.storeId;
  }
  return chromeCallback(chrome.cookies.remove, chrome.cookies, [details]);
}

export async function removeCookiesForDomain(domain, includeRelated) {
  const normalized = normalizeDomainInput(domain);
  if (!normalized) {
    throw new Error("Không thể xóa cookie cho tên miền không hợp lệ.");
  }

  const clean = stripLeadingDot(normalized);
  const cookies = await getCookiesForDomain(clean, Boolean(includeRelated));
  let removed = 0;

  for (const cookie of cookies) {
    try {
      const result = await removeBrowserCookie(cookie);
      if (result) {
        removed += 1;
      }
    } catch (error) {
      // Keep removing the rest of the affected domain.
    }
  }

  return removed;
}

export async function downloadTextFile(text, filename, mimeType) {
  const blob = new Blob([text], { type: mimeType || "text/plain" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    await chromeCallback(chrome.downloads.download, chrome.downloads, [{
      url: objectUrl,
      filename: filename,
      saveAs: true
    }]);
  } finally {
    setTimeout(function () {
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  }
}
