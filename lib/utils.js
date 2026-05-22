export function normalizeDomainInput(input) {
  let value = String(input || "").trim();
  if (!value) {
    return "";
  }

  let hadLeadingDot = value.startsWith(".");

  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      const parsed = new URL(value);
      value = parsed.hostname;
      hadLeadingDot = value.startsWith(".");
    }
  } catch {
    return "";
  }

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  value = value.split(/[/?#]/)[0];
  value = value.replace(/:\d+$/, "");
  value = value.trim().toLowerCase();

  while (value.startsWith("..")) {
    value = value.slice(1);
  }

  const clean = stripLeadingDot(value);
  if (!clean || /[\s/\\]/.test(clean)) {
    return "";
  }

  return hadLeadingDot ? "." + clean : clean;
}

export function stripLeadingDot(domain) {
  return String(domain || "").trim().replace(/^\.+/, "").toLowerCase();
}

export function isDomainLike(domain) {
  const clean = stripLeadingDot(domain);
  if (!clean) {
    return false;
  }
  if (clean === "localhost") {
    return true;
  }
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*$/i.test(clean);
}

export function ensurePath(path) {
  const value = String(path || "/").trim() || "/";
  return value.startsWith("/") ? value : "/" + value;
}

export function cookieKey(cookie) {
  return [
    cookie.storeId || "",
    cookie.partitionKey ? JSON.stringify(cookie.partitionKey) : "",
    String(cookie.domain || "").toLowerCase(),
    cookie.path || "/",
    cookie.name || ""
  ].join("\n");
}

export function uniqueCookies(cookies) {
  const seen = new Set();
  const result = [];
  for (const cookie of cookies || []) {
    const key = cookieKey(cookie);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cookie);
    }
  }
  return result;
}

export function domainMatchesTarget(cookieDomain, targetDomain, includeRelated) {
  const cookieClean = stripLeadingDot(cookieDomain);
  const targetClean = stripLeadingDot(targetDomain);
  if (!cookieClean || !targetClean) {
    return false;
  }
  if (cookieClean === targetClean) {
    return true;
  }
  if (!includeRelated) {
    return false;
  }
  return cookieClean.endsWith("." + targetClean) || targetClean.endsWith("." + cookieClean);
}

export function getDomainCandidates(hostname) {
  const clean = stripLeadingDot(hostname);
  if (!clean) {
    return [];
  }

  const parts = clean.split(".").filter(Boolean);
  const candidates = new Set([clean]);

  for (let index = 1; index < parts.length - 1; index += 1) {
    candidates.add(parts.slice(index).join("."));
  }

  for (const candidate of Array.from(candidates)) {
    candidates.add("." + candidate);
  }

  return Array.from(candidates);
}

export function maskCookieValue(value) {
  const text = String(value || "");
  if (!text) {
    return "";
  }
  if (text.length <= 16) {
    return text.slice(0, 3) + "...";
  }
  return text.slice(0, 10) + "..." + text.slice(-3);
}

export function formatExpiry(expirationDate, session) {
  if (session || !expirationDate || Number(expirationDate) === 0) {
    return "Phiên";
  }
  const date = new Date(Number(expirationDate) * 1000);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

export function timestampForFilename(date) {
  const current = date || new Date();
  const pad = function (number) {
    return String(number).padStart(2, "0");
  };
  return [
    current.getFullYear(),
    pad(current.getMonth() + 1),
    pad(current.getDate()),
    "_",
    pad(current.getHours()),
    pad(current.getMinutes()),
    pad(current.getSeconds())
  ].join("");
}

export function formatUnixTimeLocal(unixSeconds) {
  if (!unixSeconds || unixSeconds <= 0) {
    return "Phiên";
  }

  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd + " " + hh + ":" + mi;
}

export function sanitizeFilenamePart(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

export async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back to a local textarea selection below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error("Không sao chép được vào clipboard.");
  }
}

export function textOrEmpty(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

export function boolText(value) {
  return value ? "TRUE" : "FALSE";
}

export function setTextContent(node, value) {
  node.textContent = textOrEmpty(value);
}

export function sortCookies(cookies) {
  return (cookies || []).slice().sort(function (a, b) {
    const left = [a.domain || "", a.path || "", a.name || ""].join("\n");
    const right = [b.domain || "", b.path || "", b.name || ""].join("\n");
    return left.localeCompare(right);
  });
}
