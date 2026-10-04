/** Escape text for safe interpolation into an HTML string. */
export function escapeHtml(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Prints ONLY the given HTML (not the app page) via a hidden iframe, with an A4 @page rule.
 * `title` becomes the suggested PDF file name when saving as PDF.
 */
export function printHtml(title: string, bodyHtml: string, css = ""): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  const cleanup = () => setTimeout(() => iframe.remove(), 1000);

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return cleanup();
    win.addEventListener("afterprint", cleanup);
    // Let the logo image finish loading before the print dialog snapshot.
    const imgs = Array.from(win.document.images).filter((i) => !i.complete);
    const go = () => {
      win.focus();
      win.print();
    };
    if (imgs.length === 0) return go();
    let left = imgs.length;
    const done = () => {
      if (--left <= 0) go();
    };
    imgs.forEach((i) => {
      i.addEventListener("load", done);
      i.addEventListener("error", done);
    });
  };

  iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4;margin:12mm}html,body{margin:0;padding:0;background:#fff}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}${css}</style></head><body>${bodyHtml}</body></html>`;
  document.body.appendChild(iframe);
}
