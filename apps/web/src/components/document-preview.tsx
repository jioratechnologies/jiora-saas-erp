import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText } from "lucide-react";
import { api } from "../api/client";
import { Button } from "./ui/button";
import { PdfViewer } from "./pdf-viewer";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type Kind = "image" | "pdf" | "docx" | "xlsx" | "other";

export function previewKind(mimeType?: string | null, name?: string | null): Kind {
  const m = mimeType ?? "";
  const n = (name ?? "").toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|webp)$/.test(n)) return "image";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m === DOCX || n.endsWith(".docx")) return "docx";
  if (m === XLSX || n.endsWith(".xlsx")) return "xlsx";
  return "other";
}

/** Word (.docx) rendered in-page. Legacy .doc is not supported and falls back to download. */
function DocxViewer({ path, onFail }: { path: string; onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const blob = await api.getBlob(path);
        const { renderAsync } = await import("docx-preview");
        if (cancelled || !host.current) return;
        host.current.innerHTML = "";
        await renderAsync(blob, host.current, undefined, { inWrapper: false, ignoreWidth: true, ignoreHeight: true });
      } catch {
        if (!cancelled) onFail();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, onFail]);
  return <div ref={host} className="w-full max-h-[62vh] overflow-auto bg-white p-3 text-sm text-zinc-900 rounded-xl" />;
}

/** First sheet of an .xlsx as a read-only table (first 200 rows). */
function XlsxViewer({ path, onFail }: { path: string; onFail: () => void }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const blob = await api.getBlob(path);
        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await blob.arrayBuffer());
        const ws = wb.worksheets[0];
        const out: string[][] = [];
        ws?.eachRow({ includeEmpty: false }, (row, i) => {
          if (i > 200) return;
          const cells: string[] = [];
          row.eachCell({ includeEmpty: true }, (c) => cells.push(c.text ?? ""));
          out.push(cells);
        });
        if (!cancelled) setRows(out);
      } catch {
        if (!cancelled) onFail();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, onFail]);

  if (!rows) return <p className="py-10 text-center text-xs text-muted-foreground">Loading document preview…</p>;
  return (
    <div className="w-full max-h-[62vh] overflow-auto bg-white rounded-xl text-zinc-900">
      <table className="text-xs border-collapse">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="border border-zinc-200 px-2 py-1 whitespace-nowrap">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * In-page preview for any uploaded document: images, PDF, Word (.docx) and Excel (.xlsx).
 * Other types (legacy .doc / .xls) offer a download instead.
 */
export function DocumentPreview({
  path,
  imageUrl,
  mimeType,
  name,
  onDownload,
}: {
  path: string;
  imageUrl: string;
  mimeType?: string | null;
  name?: string | null;
  onDownload: () => void;
}) {
  const kind = previewKind(mimeType, name);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [path]);
  const fail = useCallback(() => setFailed(true), []);

  if (kind === "image") {
    return <img src={imageUrl} alt={name ?? "Document"} className="max-h-[62vh] max-w-full rounded-xl object-contain shadow-md" />;
  }
  if (kind === "pdf") return <PdfViewer path={path} />;
  if (!failed && kind === "docx") return <DocxViewer path={path} onFail={fail} />;
  if (!failed && kind === "xlsx") return <XlsxViewer path={path} onFail={fail} />;

  return (
    <div className="p-8 text-center space-y-3 max-w-sm mx-auto">
      <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
      <div>
        <h6 className="font-bold text-foreground text-sm">Preview not available</h6>
        <p className="text-xs text-muted-foreground mt-1">This file type can't be shown here. Download it to view.</p>
      </div>
      <Button size="sm" onClick={onDownload} className="gap-1.5">
        <Download className="h-3.5 w-3.5" /> Download
      </Button>
    </div>
  );
}
