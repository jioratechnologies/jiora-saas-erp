import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { UploadCloud, FileText, Image, FileCheck, X, File } from "lucide-react";
import { cn } from "../../lib/utils";

export interface FileDropzoneProps {
  file: globalThis.File | null;
  onFileSelect: (file: globalThis.File | null) => void;
  accept?: string;
  maxSizeBytes?: number; // default 10MB
  disabled?: boolean;
  className?: string;
  error?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file: globalThis.File) {
  if (file.type.startsWith("image/")) {
    return <Image className="h-6 w-6 text-blue-500" />;
  }
  if (file.type === "application/pdf") {
    return <FileText className="h-6 w-6 text-red-500" />;
  }
  return <File className="h-6 w-6 text-primary" />;
}

export function FileDropzone({
  file,
  onFileSelect,
  accept = ".pdf,.doc,.docx,.png,.jpg,.jpeg",
  maxSizeBytes = 10 * 1024 * 1024, // 10MB
  disabled = false,
  className,
  error: controlledError,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const error = controlledError || internalError;

  const validateAndSetFile = (f: globalThis.File) => {
    setInternalError(null);
    if (f.size > maxSizeBytes) {
      setInternalError(`File size exceeds maximum allowed (${formatFileSize(maxSizeBytes)})`);
      return;
    }
    onFileSelect(f);
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInternalError(null);
    if (inputRef.current) inputRef.current.value = "";
    onFileSelect(null);
  };

  return (
    <div className={cn("w-full space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleInputChange}
        className="hidden"
        id="dropzone-file-input"
      />

      {file ? (
        /* Selected file card */
        <div className="flex items-center justify-between rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background border border-zinc-200/60 dark:border-zinc-800">
              {getFileIcon(file)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{file.name}</p>
              <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={handleRemove}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-zinc-200/60 hover:text-foreground dark:hover:bg-zinc-800 transition-colors"
            aria-label="Remove selected file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        /* Dropzone area */
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!disabled) inputRef.current?.click();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-6 text-center transition-all duration-200 cursor-pointer select-none",
            "border-zinc-200 dark:border-zinc-800 hover:border-primary/60 dark:hover:border-primary/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50",
            isDragOver && "border-primary bg-primary/5 dark:bg-primary/10 scale-[1.01]",
            disabled && "cursor-not-allowed opacity-50 hover:border-zinc-200",
            error && "border-red-500",
          )}
        >
          <div
            className={cn(
              "mb-2.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-muted-foreground transition-all duration-200 dark:bg-zinc-800/80 group-hover:scale-110 group-hover:text-primary group-hover:bg-primary/10",
              isDragOver && "scale-110 text-primary bg-primary/15 animate-bounce",
            )}
          >
            <UploadCloud className="h-5 w-5" />
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">
              <span className="text-primary hover:underline">Click to upload</span> or drag and drop
            </p>
            <p className="text-[11px] text-muted-foreground">
              PDF, DOCX, PNG, JPG up to {formatFileSize(maxSizeBytes)}
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 leading-tight">{error}</p>}
    </div>
  );
}
