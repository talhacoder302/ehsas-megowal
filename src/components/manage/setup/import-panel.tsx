"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2Icon, FileDownIcon, FileSpreadsheetIcon, Loader2Icon, TriangleAlertIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { FormError, useValidationMessage } from "@/components/shared/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { previewImportAction, runImportAction } from "@/app/manage/setup/actions";
import type { ServerErrorCode } from "@/lib/errors";
import { IMPORT_COLUMNS, type ImportKind } from "@/lib/imports";
import { cn } from "@/lib/utils";
import type { ImportPreview } from "@/server/imports";
import { callAction } from "@/lib/offline";

/** Fields shown on each preview row (the rest only matter when they have an error). */
const SUMMARY: Record<ImportKind, string[]> = {
  members: ["name", "fatherName", "mohalla", "joinDate", "openingDue"],
  history: ["memberNo", "month", "amount", "date"],
  cases: ["beneficiaryName", "category", "totalPaid", "date"],
};

type ImportPanelProps = {
  kind: ImportKind;
  title: string;
  description: string;
  /** Shown instead of the upload when this import cannot be used now. */
  disabledReason?: string | null;
};

/** Download the template, upload the filled file, check every row, then import the good rows. */
export function ImportPanel({ kind, title, description, disabledReason }: ImportPanelProps) {
  const t = useTranslations("imports");
  const validation = useValidationMessage();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<ServerErrorCode | null>(null);
  const [showAll, setShowAll] = useState(false);

  const form = () => {
    const data = new FormData();
    if (file) data.set("file", file);
    return data;
  };

  function reset() {
    setFile(null);
    setPreview(null);
    setShowAll(false);
    if (input.current) input.current.value = "";
  }

  async function check() {
    setBusy("preview");
    setError(null);
    const result = await callAction(() => previewImportAction(kind, form()));
    setBusy(null);
    if (!result.ok) return setError(result.error);
    setPreview(result.data);
  }

  async function save() {
    setBusy("import");
    setError(null);
    const result = await callAction(() => runImportAction(kind, form()));
    setBusy(null);
    if (!result.ok) return setError(result.error);
    toast.success(t("imported", { created: result.data.created, skipped: result.data.skipped }));
    reset();
    router.refresh();
  }

  const label = (field: string) => t(`fields.${field}` as Parameters<typeof t>[0]);
  const rows = preview ? (showAll ? preview.rows : preview.rows.filter((r) => r.errors.length > 0)) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheetIcon className="size-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button asChild variant="outline" size="sm" className="self-start">
          <a href={`/api/import/template/${kind}`} download>
            <FileDownIcon />
            {t("template")}
          </a>
        </Button>

        {disabledReason ? (
          <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{disabledReason}</p>
        ) : (
          <>
            <input
              ref={input}
              type="file"
              accept=".xlsx,.xls,.csv"
              aria-label={t("chooseFile")}
              className="block w-full text-sm file:me-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setError(null);
              }}
            />
            <FormError code={error} />
            <Button size="lg" variant={preview ? "outline" : "default"} className="self-start" disabled={!file || busy !== null} onClick={check}>
              {busy === "preview" ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
              {t("check")}
            </Button>
          </>
        )}

        {preview ? (
          <div className="flex flex-col gap-3">
            {preview.missingColumns.length > 0 ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {t("missingColumns", { columns: preview.missingColumns.join(", ") })}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge className="bg-emerald-600 text-white">{t("validRows", { count: preview.validCount })}</Badge>
                {preview.errorCount > 0 ? <Badge variant="destructive">{t("errorRows", { count: preview.errorCount })}</Badge> : null}
              </div>
            )}

            {preview.rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("noRows")}</p> : null}

            {rows.length > 0 ? (
              <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
                {rows.map((row) => (
                  <li
                    key={row.rowNumber}
                    className={cn("flex flex-col gap-1 rounded-lg border p-2 text-xs", row.errors.length > 0 && "border-destructive/40 bg-destructive/5")}
                  >
                    <div className="flex items-center gap-2">
                      {row.errors.length > 0 ? (
                        <TriangleAlertIcon className="size-4 shrink-0 text-destructive" />
                      ) : (
                        <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
                      )}
                      <span className="font-medium">{t("row", { number: row.rowNumber })}</span>
                      <span dir="auto" className="truncate text-muted-foreground">
                        {SUMMARY[kind].map((f) => row.cells[f]).filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    {row.errors.map((e) => (
                      <span key={e.field} className="ps-6 text-destructive">
                        {label(e.field)}: {validation(e.code)}
                        {row.cells[e.field] ? (
                          <span dir="auto" className="text-muted-foreground">{` (${row.cells[e.field]})`}</span>
                        ) : null}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            ) : null}

            {preview.rows.length > 0 ? (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll((v) => !v)}>
                {showAll ? t("showProblems") : t("showAll", { count: preview.rows.length })}
              </Button>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button size="lg" disabled={preview.validCount === 0 || busy !== null} onClick={save}>
                {busy === "import" ? <Loader2Icon className="animate-spin" /> : null}
                {t("importRows", { count: preview.validCount })}
              </Button>
              <Button size="lg" variant="ghost" disabled={busy !== null} onClick={reset}>
                {t("startOver")}
              </Button>
            </div>
            {preview.errorCount > 0 && preview.validCount > 0 ? <p className="text-xs text-muted-foreground">{t("skipHint")}</p> : null}
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("columnsHint", { columns: IMPORT_COLUMNS[kind].filter((c) => c.required).map((c) => c.header).join(", ") })}</p>
      </CardContent>
    </Card>
  );
}
