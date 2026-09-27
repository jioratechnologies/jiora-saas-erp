/**
 * Utility to generate and trigger browser download of clean CSV files.
 * Supports both:
 * 1) exportToCsv(filename, headers, rowsArray)
 * 2) exportToCsv(filename, objectRows)
 */
export function exportToCsv(
  filename: string,
  arg2: string[] | Record<string, any>[],
  arg3?: (string | number | boolean | null | undefined)[][],
) {
  let headers: string[] = [];
  let rows: (string | number | boolean | null | undefined)[][] = [];

  if (Array.isArray(arg2) && typeof arg2[0] === "string") {
    headers = arg2 as string[];
    rows = arg3 || [];
  } else if (Array.isArray(arg2) && typeof arg2[0] === "object" && arg2[0] !== null) {
    const objectRows = arg2 as Record<string, any>[];
    headers = Object.keys(objectRows[0] || {});
    rows = objectRows.map((row) => headers.map((h) => row[h]));
  }

  const sanitizeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(sanitizeCell).join(","),
    ...rows.map((row) => row.map(sanitizeCell).join(",")),
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
