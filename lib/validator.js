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
    return { session: true, expirationDate: undefined };
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    errors.push("expirationDate phải là Unix timestamp theo giây.");
    return { session: true, expirationDate: undefined };
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

export function validateCookieForImport(rawCookie, options) {
  const raw = rawCookie || {};
  const settings = options || {};
  const errors = [];
  const warnings = [];
  const targetDomain = normalizeDomainInput(settings.targetDomain || "");
  const rawDomain = targetDomain || normalizeDomainInput(raw.domain || "");

  const name = raw.name === undefined || raw.name === null ? "" : String(raw.name);

  if (!name) {
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

  const expiration = normalizeExpiration(raw.expirationDate, raw.session === true, errors, warnings);
  const domain = rawDomain;
  const hostOnly = domain.startsWith(".") ? false : Boolean(raw.hostOnly);

  const cookie = Object.assign({}, raw, {
    domain: domain,
    hostOnly: hostOnly,
    path: ensurePath(raw.path || "/"),
    secure: secure,
    httpOnly: httpOnly,
    sameSite: sameSite || undefined,
    session: expiration.session,
    expirationDate: expiration.expirationDate,
    name: name,
    value: raw.value === undefined || raw.value === null ? "" : String(raw.value),
    sourceIndex: raw.sourceIndex || 0
  });

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

function positiveExpirationDate(cookie) {
  const value = Number(cookie && cookie.expirationDate);
  return Number.isFinite(value) && value > 0 ? value : 0;
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
    const expirationDate = positiveExpirationDate(cookie);
    const session = Boolean(cookie && cookie.session) || !expirationDate;
    const domain = String((cookie && cookie.domain) || "");

    report.total += 1;

    if (cookie && cookie.partitionKey) {
      report.withPartitionKey += 1;
    }
    if (cookie && cookie.httpOnly) {
      report.httpOnly += 1;
    }
    if (cookie && cookie.secure) {
      report.secure += 1;
    }
    if (domain) {
      report.domains[domain] = (report.domains[domain] || 0) + 1;
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
    if (expirationDate > now && (
      !report.earliestExpirationDate || expirationDate < report.earliestExpirationDate
    )) {
      report.earliestExpirationDate = expirationDate;
      report.earliestExpirationCookieName = String((cookie && cookie.name) || "");
    }
  }

  return report;
}

export function formatCookieHealthSummary(report) {
  if (!report) {
    return "";
  }

  let summary = [
    "Tổng: " + (report.total || 0) + " cookie",
    "Phiên: " + (report.session || 0),
    "Có hạn: " + (report.persistent || 0),
    "Hết hạn: " + (report.expired || 0),
    "Sắp hết hạn 24h: " + (report.nearExpiry24h || 0),
    "Có partitionKey: " + (report.withPartitionKey || 0)
  ].join(" | ");

  if (report.earliestExpirationDate) {
    summary += " | Hạn gần nhất: " + formatUnixTimeLocal(report.earliestExpirationDate);
  }

  return summary;
}
