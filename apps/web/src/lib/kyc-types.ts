export const OTHER_ID_TYPE = "Other ID";

/** Identity documents offered in the KYC type dropdown. */
export const KYC_ID_TYPES = [
  { label: "Aadhaar Card", hint: "e.g. 5423-8891-1029" },
  { label: "PAN Card", hint: "e.g. ABCDE1234F" },
  { label: "Passport", hint: "e.g. Z9876543" },
  { label: "Voter ID", hint: "e.g. ABC1234567" },
  { label: "Driving Licence", hint: "e.g. DL-0420110149646" },
  { label: OTHER_ID_TYPE, hint: "Enter the ID number" },
] as const;

export function kycHint(type: string): string {
  return KYC_ID_TYPES.find((t) => t.label === type)?.hint ?? "Enter the ID number";
}
