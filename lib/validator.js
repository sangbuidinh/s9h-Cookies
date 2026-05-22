import { ensurePath, formatUnixTimeLocal, isDomainLike, normalizeDomainInput, stripLeadingDot } from "./utils.js";

const VALID_SAME_SITE = ["no_restriction", "lax", "strict", "unspecified"];

function normalizeSameSite(value) {
  if (value === undefined || value === null || value === "") {
    return "unspecified";
  }

  const normalized = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "none") {
    return "no_restriction";
  }
  if (VALID_SAME_SITE.includes(normalized)) {
    return normalized;
  }
  return "";
}

function requireBoolean(value, field, defaultValue, errors) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  errors.push(field + " phải là boolean.");
  return defaultValue;
}

function normalizeExpiration(value, session, errors, warnings) {
  if (session || value === undefined || value === null || value === "" || Number(value) === 0) {
    return { session: true, expirationDate: 0 };
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    errors.push("expirationDate phải là Unix timestamp theo giây.");
    return { session: true, expirationDate: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  const oneDay = 24 * 60 * 60;
  const sevenDays = 7 * oneDay;

  if (number < now) {
    errors.push("Cookie đã hết hạn.");
    return { session: false, expirationDate: number };
  }

  if (number <= now + oneDay) {
    warnings.push("Cookie sắp hết hạn trong 24 giờ.");
  } else if (number <= now + sevenDays) {
    warnings.push("Cookie sắp hết hạn trong 7 ngày.");
  }

  return { session: false, expirationDate: number };
}

function copyOptionalFields(raw, cookie) {
  if (raw.storeId) {
    cookie.storeId = raw.storeId;
  }
  if (raw.partitionKey) {
    cookie.partitionKey = raw.partitionKey;
  }
  if (raw.firstPartyDomain) {
    cookie.firstPartyDomain = raw.firstPartyDomain;
  }
  if (raw.sourceScheme) {
    cookie.sourceScheme = raw.sourceScheme;
  }
  if (typeof raw.sourcePort === "number") {
    cookie.sourcePort = raw.sourcePort;
  }
}

export function validateCookieForImport(rawCookie, options) {
  const raw = rawCookie || {};
  const settings = options || {};
  const errors = [];
  const warnings = [];
  const targetDomain = normalizeDomainInput(settings.targetDomain || "");
  const rawDomain = targetDomain || normalizeDomainInput(raw.domain || "");

  if (!raw.name) {
    errors.push("name không được để trống.");
  }

  if (!rawDomain) {
    errors.push("domain không được để trống.");
  } else if (!isDomainLike(rawDomain)) {
    errors.push("domain không hợp lệ.");
  }

  const secure = requireBoolean(raw.secure, "secure", false, errors);
  const httpOnly = requireBoolean(raw.httpOnly, "httpOnly", false, errors);
  const sameSite = normalizeSameSite(raw.sameSite);
  if (!sameSite) {
    warnings.push("sameSite không hợp lệ nên đã được bỏ qua.");
  }

  const expiration = normalizeExpiration(raw.expirationDate, Boolean(raw.session), errors, warnings);
  const domain = rawDomain;
  const hostOnly = domain.startsWith(".") ? false : Boolean(raw.hostOnly);

  const cookie = {
    domain: domain,
    hostOnly: hostOnly,
    path: ensurePath(raw.path || "/"),
    secure: secure,
    httpOnly: httpOnly,
    sameSite: sameSite || undefined,
    session: expiration.session,
    expirationDate: expiration.expirationDate,
    name: String(raw.name || ""),
    value: raw.value === undefined || raw.value === null ? "" : String(raw.value),
    sourceIndex: raw.sourceIndex || 0
  };
  copyOptionalFields(raw, cookie);

  if (!stripLeadingDot(cookie.domain)) {
    errors.push("domain không được để trống.");
  }

  return {
    valid: errors.length === 0,
    cookie: cookie,
    reason: errors.join(" "),
    warnings: warnings
  };
}

export function analyzeCookieHealth(cookies) {
  const now = Math.floor(Date.now() / 1000);
  const oneDay = 24 * 60 * 60;
  const sevenDays = 7 * oneDay;
  const report = {
    total: 0,
    session: 0,
    persistent: 0,
    expired: 0,
    nearExpiry24h: 0,
    expiringSoon7d: 0,
    withPartitionKey: 0,
    httpOnly: 0,
    secure: 0,
    domains: {},
    earliestExpirationDate: null,
    earliestExpirationCookieName: ""
  };

  for (const cookie of cookies || []) {
    const expirationDate = Number(cookie && cookie.expirationDate);
    const hasPositiveExpiry = Number.isFinite(expirationDate) && expirationDate > 0;
    const session = Boolean(cookie && cookie.session) || !hasPositiveExpiry;
    const domain = String(cookie && cookie.domain || "");

    report.total += 1;
    report.domains[domain] = (report.domains[domain] || 0) + 1;

    if (cookie && cookie.partitionKey) {
      report.withPartitionKey += 1;
    }
    if (cookie && cookie.httpOnly) {
      report.httpOnly += 1;
    }
    if (cookie && cookie.secure) {
      report.secure += 1;
    }

    if (session) {
      report.session += 1;
      continue;
    }

    report.persistent += 1;

    if (expirationDate < now) {
      report.expired += 1;
      continue;
    }

    if (expirationDate <= now + oneDay) {
      report.nearExpiry24h += 1;
    }
    if (expirationDate <= now + sevenDays) {
      report.expiringSoon7d += 1;
    }

    if (report.earliestExpirationDate === null || expirationDate < report.earliestExpirationDate) {
      report.earliestExpirationDate = expirationDate;
      report.earliestExpirationCookieName = String(cookie.name || "");
    }
  }

  return report;
}

export function formatCookieHealthSummary(report) {
  const value = report || analyzeCookieHealth([]);
  let summary = [
    "Tổng: " + value.total + " cookie",
    "Phiên: " + value.session,
    "Có hạn: " + value.persistent,
    "Hết hạn: " + value.expired,
    "Sắp hết hạn 24h: " + value.nearExpiry24h,
    "Có partitionKey: " + value.withPartitionKey
  ].join(" | ");

  if (value.earliestExpirationDate) {
    summary += " | Hạn gần nhất: " + formatUnixTimeLocal(value.earliestExpirationDate);
  }

  return summary;
}
