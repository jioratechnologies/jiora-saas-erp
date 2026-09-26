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
