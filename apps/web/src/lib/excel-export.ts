type Cell = string | number | boolean | null | undefined | Date;

/** Cells starting with these are treated as formulas by Excel; force them to plain text. */
const FORMULA_PREFIX = /^[=+\-@]/;

function normalizeCell(val: Cell): string | number | boolean | Date | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") {
    return FORMULA_PREFIX.test(val) ? `'${val}` : val;
  }
  return val;
}

/**
 * Builds and downloads a styled .xlsx file. `exceljs` is loaded on demand so it
 * stays out of the main bundle.
 *
 * Supports both:
 * 1) exportToExcel(filename, headers, rowsArray)
 * 2) exportToExcel(filename, objectRows)
 */
export async function exportToExcel(
  filename: string,
  arg2: string[] | Record<string, unknown>[],
  arg3?: Cell[][],
  sheetName = "Export",
): Promise<void> {
  let headers: string[] = [];
  let rows: Cell[][] = [];

  if (Array.isArray(arg2) && typeof arg2[0] === "string") {
    headers = arg2 as string[];
    rows = arg3 || [];
  } else if (Array.isArray(arg2) && typeof arg2[0] === "object" && arg2[0] !== null) {
    const objectRows = arg2 as Record<string, unknown>[];
    headers = Object.keys(objectRows[0] || {});
    rows = objectRows.map((row) => headers.map((h) => row[h] as Cell));
  }

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  headerRow.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const row of rows) sheet.addRow(row.map(normalizeCell));

  sheet.columns.forEach((column, index) => {
    let max = String(headers[index] ?? "").length;
    for (const row of rows) {
      const cell = row[index];
      const len = cell instanceof Date ? 10 : String(cell ?? "").length;
      if (len > max) max = len;
    }
    column.width = Math.min(Math.max(max + 2, 10), 50);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
  document.body.appendChild(link);
  link.click();
  // Revoking in the same tick cancels the download in Firefox/Safari.
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}
