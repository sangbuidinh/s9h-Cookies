import {
  domainMatchesTarget,
  ensurePath,
  getDomainCandidates,
  normalizeDomainInput,
  sanitizeFilenamePart,
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

const SYSTEM_TAB_COOKIE_ERROR = "Tab hiện tại là trang hệ thống của trình duyệt, không có cookie website để lấy. Hãy mở website thật hoặc chọn chế độ Tên miền / Tất cả cookie.";

export async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length ? tabs[0] : null;
}

export async function getCookieStoreIdForActiveTab() {
  try {
    const tab = await getActiveTab();

    if (!tab || typeof tab.id !== "number") {
      return undefined;
    }

    const stores = await chrome.cookies.getAllCookieStores();

    for (const store of stores) {
      if (Array.isArray(store.tabIds) && store.tabIds.includes(tab.id)) {
        return store.id;
      }
    }

    return undefined;
  } catch (error) {
    return undefined;
  }
}

function buildGetAllDetails(baseDetails, storeId) {
  const details = Object.assign({}, baseDetails || {});
  if (storeId) {
    details.storeId = storeId;
  }
  return details;
}

async function withActiveStoreDetails(baseDetails) {
  const storeId = await getCookieStoreIdForActiveTab();
  return buildGetAllDetails(baseDetails, storeId);
}

export function isBrowserInternalUrl(url) {
  return /^(chrome|edge|brave|about|devtools):\/\//i.test(url || "");
}

export async function getCurrentTabHostname() {
  const tab = await getActiveTab();
  if (!tab || !tab.url) {
    throw new Error("Không lấy được URL của tab hiện tại.");
  }

  if (isBrowserInternalUrl(tab.url) || /^about:blank(?:$|[?#])/i.test(tab.url)) {
    throw new Error(SYSTEM_TAB_COOKIE_ERROR);
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
  const details = await withActiveStoreDetails({});
  return chromeCallback(chrome.cookies.getAll, chrome.cookies, [details]);
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
      const details = await withActiveStoreDetails({ domain: queryDomain });
      const cookies = await chromeCallback(chrome.cookies.getAll, chrome.cookies, [details]);
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

async function trySetCookieDetails(details) {
  try {
    return await chromeCallback(chrome.cookies.set, chrome.cookies, [details]);
  } catch (error) {
    if (details.partitionKey) {
      const fallbackDetails = Object.assign({}, details);
      delete fallbackDetails.partitionKey;
      return chromeCallback(chrome.cookies.set, chrome.cookies, [fallbackDetails]);
    }
    throw error;
  }
}

export async function setBrowserCookie(cookie) {
  const details = {
    url: buildCookieUrl(cookie),
    name: String(cookie.name),
    value: cookie.value === undefined || cookie.value === null ? "" : String(cookie.value),
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

  const expirationDate = Number(cookie.expirationDate);
  if (!cookie.session && Number.isFinite(expirationDate) && expirationDate > 0 && expirationDate > Date.now() / 1000) {
    details.expirationDate = expirationDate;
  }

  const storeId = await getCookieStoreIdForActiveTab();
  if (storeId) {
    details.storeId = storeId;
  }
  if (cookie.partitionKey) {
    details.partitionKey = cookie.partitionKey;
  }

  return trySetCookieDetails(details);
}

export async function removeBrowserCookie(cookie) {
  const details = {
    url: buildCookieUrl(cookie),
    name: cookie.name
  };
  const storeId = cookie.storeId || await getCookieStoreIdForActiveTab();
  if (storeId) {
    details.storeId = storeId;
  }
  return chromeCallback(chrome.cookies.remove, chrome.cookies, [details]);
}

export async function removeCookiesForDomain(domain, includeRelated) {
  const normalized = normalizeDomainInput(domain);
  if (!normalized) {
    throw new Error("Không thể xóa cookie cho tên miền không hợp lệ.");
  }

  const clean = stripLeadingDot(normalized);
  const storeId = await getCookieStoreIdForActiveTab();
  const cookies = await getCookiesForDomain(clean, Boolean(includeRelated));
  let removed = 0;

  for (const cookie of cookies) {
    if (storeId && cookie.storeId && cookie.storeId !== storeId) {
      continue;
    }

    try {
      const cookieForRemoval = storeId ? Object.assign({}, cookie, { storeId: storeId }) : cookie;
      const result = await removeBrowserCookie(cookieForRemoval);
      if (result) {
        removed += 1;
      }
    } catch (error) {
      // Keep removing the rest of the affected domain.
    }
  }

  return removed;
}

export async function reloadActiveTab() {
  const tab = await getActiveTab();
  if (tab && typeof tab.id === "number") {
    await chrome.tabs.reload(tab.id);
    return true;
  }
  return false;
}

export async function downloadTextFile(text, filename, mimeType) {
  const blob = new Blob([text], { type: mimeType || "text/plain" });
  const objectUrl = URL.createObjectURL(blob);
  const safeFilename = sanitizeFilenamePart(filename) || "cookies.txt";

  try {
    try {
      await chromeCallback(chrome.downloads.download, chrome.downloads, [{
        url: objectUrl,
        filename: safeFilename,
        saveAs: true,
        conflictAction: "uniquify"
      }]);
    } catch (error) {
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = safeFilename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  } finally {
    setTimeout(function () {
      URL.revokeObjectURL(objectUrl);
    }, 10000);
  }
}
