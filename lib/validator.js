import { ensurePath, isDomainLike, normalizeDomainInput, stripLeadingDot } from "./utils.js";

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

function normalizeExpiration(value, session, errors) {
  if (session || value === undefined || value === null || value === "" || Number(value) === 0) {
    return { session: true, expirationDate: 0 };
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    errors.push("expirationDate phải là Unix timestamp theo giây.");
    return { session: true, expirationDate: 0 };
  }

  if (number <= Date.now() / 1000) {
    errors.push("Cookie đã hết hạn.");
    return { session: false, expirationDate: number };
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

  const expiration = normalizeExpiration(raw.expirationDate, Boolean(raw.session), errors);
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
