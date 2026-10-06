"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CameraIcon, CircleAlertIcon, ImageOffIcon, Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createUploadAction } from "@/app/manage/actions";
import type { ServerErrorCode } from "@/lib/errors";
import { MAX_UPLOAD_BYTES, TARGET_UPLOAD_MB, type ReceiptKind } from "@/lib/uploads";

type PhotoUploadProps = {
  kind: ReceiptKind;
  /** The uploaded object key, or null. */
  value: string | null;
  onChange: (key: string | null) => void;
  /** Whether R2 is configured on the server (features.uploads). */
  enabled: boolean;
  /** Tells the form not to submit while a photo is still uploading. */
  onBusyChange?: (busy: boolean) => void;
};

type State =
  | { step: "idle" }
  | { step: "compressing" }
  | { step: "uploading" }
  | { step: "done"; previewUrl: string; size: number }
  | { step: "error"; code: ServerErrorCode | "uploadFailed" | "photoRead" };

/**
 * Receipt photo picker: compresses the photo in the browser (about 150 KB),
 * gets a pre-signed URL from the server and uploads straight to R2. Only the
 * object key reaches the form. Without R2 it explains that the record can be
 * saved without a photo.
 */
export function PhotoUpload({ kind, value, onChange, enabled, onBusyChange }: PhotoUploadProps) {
  const t = useTranslations();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ step: "idle" });

  // Free the preview image when it is replaced or the form closes.
  useEffect(() => {
    return () => {
      if (state.step === "done") URL.revokeObjectURL(state.previewUrl);
    };
  }, [state]);

  if (!enabled) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <ImageOffIcon className="mt-0.5 size-4 shrink-0" />
        <span>{t("photo.disabled")}</span>
      </div>
    );
  }

  const busy = state.step === "compressing" || state.step === "uploading";

  async function upload(file: File) {
    onBusyChange?.(true);
    onChange(null);
    try {
      setState({ step: "compressing" });
      // Loaded only when needed; the web worker is off so it never fetches code from a CDN.
      const { default: imageCompression } = await import("browser-image-compression");
      const compressed = await imageCompression(file, {
        maxSizeMB: TARGET_UPLOAD_MB,
        maxWidthOrHeight: 1600,
        useWebWorker: false,
        fileType: "image/jpeg",
        initialQuality: 0.8,
      }).catch(() => null);
      if (!compressed) return setState({ step: "error", code: "photoRead" });
      if (compressed.size > MAX_UPLOAD_BYTES) return setState({ step: "error", code: "photoTooLarge" });

      setState({ step: "uploading" });
      const ticket = await createUploadAction({ kind, contentType: "image/jpeg", size: compressed.size });
      if (!ticket.ok) return setState({ step: "error", code: ticket.error });

      const response = await fetch(ticket.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": ticket.data.contentType },
        body: compressed,
      }).catch(() => null);
      if (!response?.ok) return setState({ step: "error", code: "uploadFailed" });

      setState({ step: "done", previewUrl: URL.createObjectURL(compressed), size: compressed.size });
      onChange(ticket.data.key);
    } finally {
      onBusyChange?.(false);
    }
  }

  function clear() {
    setState({ step: "idle" });
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {state.step === "done" && value ? (
        <div className="flex items-center gap-3 rounded-lg border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not an optimisable image */}
          <img src={state.previewUrl} alt={t("photo.preview")} className="size-16 rounded-md object-cover" />
          <div className="flex min-w-0 flex-1 flex-col text-sm">
            <span className="font-medium">{t("photo.uploaded")}</span>
            <span className="text-xs text-muted-foreground">{Math.round(state.size / 1024)} KB</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={clear} aria-label={t("photo.remove")}>
            <XIcon />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 text-sm transition-colors hover:bg-muted/50 ${busy ? "pointer-events-none opacity-70" : ""}`}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
            {busy ? <Loader2Icon className="size-5 animate-spin" /> : <CameraIcon className="size-5" />}
          </span>
          <span className="flex flex-col">
            <span className="font-medium">
              {state.step === "compressing"
                ? t("photo.compressing")
                : state.step === "uploading"
                  ? t("photo.uploading")
                  : t("photo.add")}
            </span>
            <span className="text-xs text-muted-foreground">{t("photo.hint")}</span>
          </span>
        </label>
      )}

      {state.step === "error" ? (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          {state.code === "uploadFailed" || state.code === "photoRead" ? t(`photo.${state.code}`) : t(`serverErrors.${state.code}`)}
        </p>
      ) : null}
    </div>
  );
}
