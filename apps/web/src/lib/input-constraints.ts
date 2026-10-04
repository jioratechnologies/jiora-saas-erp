/**
 * Global input constraints, text length limits, and validation patterns for SaaS ERP.
 * Provides unified type safety and input boundaries across the entire system.
 */

export const INPUT_LIMITS = {
  // Names & Titles
  PERSON_NAME_MIN: 2,
  PERSON_NAME_MAX: 60,
  ORG_NAME_MIN: 2,
  ORG_NAME_MAX: 100,
  DOCUMENT_TITLE_MIN: 2,
  DOCUMENT_TITLE_MAX: 100,
  DOC_TITLE_MAX: 100,
  DOCUMENT_NUMBER_MIN: 4,
  DOCUMENT_NUMBER_MAX: 50,
  DOC_NUMBER_MAX: 50,

  // Contact & Address
  EMAIL_MAX: 100,
  PHONE_NUMBER_MIN: 7,
  PHONE_NUMBER_MAX: 15,
  ADDRESS_MAX: 250,
  EMERGENCY_NAME_MAX: 60,

  // Textareas & Descriptions
  REJECTION_REASON_MIN: 5,
  REJECTION_REASON_MAX: 300,
  EXIT_REASON_MIN: 3,
  EXIT_REASON_MAX: 300,
  LEAVE_REASON_MAX: 250,
} as const;

export const REGEX_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  DIGITS_ONLY: /^\d+$/,
  PHONE_DIGITS: /^[0-9\s-]{7,15}$/,
  HEX_COLOR: /^#[0-9A-Fa-f]{6}$/,
} as const;

export type EmergencyRelation =
  | "Spouse"
  | "Mother"
  | "Father"
  | "Brother"
  | "Sister"
  | "Parent"
  | "Sibling"
  | "Child"
  | "Guardian"
  | "Friend"
  | "Colleague"
  | "Other";

export const EMERGENCY_RELATIONS: EmergencyRelation[] = [
  "Spouse",
  "Mother",
  "Father",
  "Brother",
  "Sister",
  "Parent",
  "Sibling",
  "Child",
  "Guardian",
  "Friend",
  "Colleague",
  "Other",
];

export interface ParsedEmergencyContact {
  phone: string;
  relation: EmergencyRelation | string;
  name: string;
}

/**
 * Parses composite emergency contact strings like:
 * "+91 9876543299 (Spouse - Priya)" or "+91 9876543299 (Father)"
 */
export function parseEmergencyContact(raw?: string | null): ParsedEmergencyContact {
  if (!raw || !raw.trim()) {
    return { phone: "", relation: "Spouse", name: "" };
  }

  const str = raw.trim();
  const match = str.match(/^(.*?)(?:\s*\((.*?)\))?$/);
  const phone = match && match[1] ? match[1].trim() : str;
  const paren = match && match[2] ? match[2].trim() : "";

  let relation = "Spouse";
  let name = "";

  if (paren) {
    if (paren.includes("-")) {
      const parts = paren.split("-").map((s) => s.trim());
      relation = parts[0] || "Spouse";
      name = parts.slice(1).join(" ") || "";
    } else {
      relation = paren;
    }
  }

  return { phone, relation, name };
}

/**
 * Formats structured emergency contact into stored string
 */
export function formatEmergencyContact(phone: string, relation: string, name?: string): string {
  if (!phone.trim()) return "";
  const parenParts = [relation.trim(), name?.trim()].filter(Boolean);
  if (parenParts.length > 0) {
    return `${phone.trim()} (${parenParts.join(" - ")})`;
  }
  return phone.trim();
}

// ─── Person contact / identity validation (mirrors API CreatePersonDto) ──────

/** Same pattern the API enforces for phone / altPhone. */
export const PHONE_REGEX = /^\+?[0-9 ]{8,15}$/;

export const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
] as const;

export const PERSON_FIELD_MESSAGES = {
  phoneRequired: "Please enter a phone number.",
  phoneInvalid: "Please enter a valid phone number (8 to 15 digits, optional leading +).",
  genderRequired: "Please select a gender.",
  dobRequired: "Please enter the date of birth.",
  dobFuture: "Date of birth cannot be in the future.",
} as const;

/** Maps legacy values like "Female" to "FEMALE"; unknown values become "" so the user must pick one. */
export function normalizeGender(raw?: string | null): string {
  const up = (raw ?? "").trim().toUpperCase();
  return GENDER_OPTIONS.some((g) => g.value === up) ? up : "";
}

/** first + middle (only if present) + last. */
export function fullName(p?: { firstName?: string | null; middleName?: string | null; lastName?: string | null } | null): string {
  if (!p) return "";
  return [p.firstName, p.middleName, p.lastName]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function isFutureDate(iso: string): boolean {
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t > Date.now();
}

export interface PersonContactValues {
  phone: string;
  altPhone?: string;
  gender: string;
  dob: string;
  emergencyPhone?: string;
}

/** Returns a field -> message map; empty when valid. Keys: phone, altPhone, gender, dob, emergencyPhone. */
export function validatePersonContact(v: PersonContactValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const phone = v.phone.trim();
  if (!phone) errors.phone = PERSON_FIELD_MESSAGES.phoneRequired;
  else if (!PHONE_REGEX.test(phone)) errors.phone = PERSON_FIELD_MESSAGES.phoneInvalid;

  if (v.altPhone?.trim() && !PHONE_REGEX.test(v.altPhone.trim())) errors.altPhone = PERSON_FIELD_MESSAGES.phoneInvalid;
  if (v.emergencyPhone?.trim() && !PHONE_REGEX.test(v.emergencyPhone.trim())) errors.emergencyPhone = PERSON_FIELD_MESSAGES.phoneInvalid;

  if (!normalizeGender(v.gender)) errors.gender = PERSON_FIELD_MESSAGES.genderRequired;

  if (!v.dob) errors.dob = PERSON_FIELD_MESSAGES.dobRequired;
  else if (Number.isNaN(Date.parse(v.dob)) || isFutureDate(v.dob)) errors.dob = PERSON_FIELD_MESSAGES.dobFuture;

  return errors;
}
