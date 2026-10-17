"use client";

import { RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Reloads the page (on the offline page, where the router cannot help). */
export function RetryButton({ label }: { label: string }) {
  return (
    <Button size="lg" className="self-start" onClick={() => window.location.reload()}>
      <RotateCwIcon />
      {label}
    </Button>
  );
}
