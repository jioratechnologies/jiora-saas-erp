import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { api } from "../api/client";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Renders a PDF page by page onto canvases. Phone browsers can't show PDFs inside an
 * iframe (they offer an "Open" button instead), so the bytes are fetched through the API
 * and drawn in the page itself.
 */
export function PdfViewer({ path }: { path: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let doc: pdfjs.PDFDocumentProxy | null = null;
    setState("loading");

    (async () => {
      try {
        const blob = await api.getBlob(path);
        const data = new Uint8Array(await blob.arrayBuffer());
        doc = await pdfjs.getDocument({ data }).promise;
        const host = hostRef.current;
        if (cancelled || !host) return;
        host.innerHTML = "";
        const width = host.clientWidth || 320;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          const viewport = page.getViewport({ scale: scale * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText = `width:${width}px;height:${(base.height * scale).toFixed(0)}px;display:block;margin:0 auto 8px;background:#fff;border-radius:6px`;
          host.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
          if (n === 1) setState("ready");
        }
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      void doc?.destroy();
    };
  }, [path]);

  return (
    <div className="w-full max-h-[62vh] overflow-y-auto p-2">
      {state === "loading" && (
        <div className="py-10 text-center space-y-2">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">Loading document preview…</p>
        </div>
      )}
      {state === "error" && (
        <p className="py-10 text-center text-xs text-muted-foreground">
          This document can't be previewed here. Please use Download or the open button above.
        </p>
      )}
      <div ref={hostRef} />
    </div>
  );
}
