/**
 * Pure frontend validation for cron creation/edition (spec §CRN-002).
 * The backend remains authoritative; these checks give fast, field-specific
 * feedback without a network round-trip.
 */

/**
 * A standard five-field cron expression (minute hour dom month dow), without
 * seconds. Field-level syntax is kept permissive here; the backend validates
 * ranges and semantics authoritatively.
 */
export function isValidCronExpression(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field) => /^[*,/\-?\d]+$/.test(field) && field.length > 0);
}

/** A valid IANA timezone identifier (e.g. "UTC", "Europe/Paris"). */
export function isValidTimeZone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
