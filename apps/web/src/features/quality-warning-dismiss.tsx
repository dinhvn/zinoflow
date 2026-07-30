"use client";

import { useState } from "react";
import type { QualityGateName } from "@zinoflow/contracts";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

/** Ghi dismiss reason de do false positive; warning van hien va khong doi thanh pass. */
export function QualityWarningDismiss({
  targetType,
  targetId,
  gateName,
  details,
}: {
  targetType: "content-job" | "destination";
  targetId: string;
  gateName: QualityGateName;
  details: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (saved)
    return (
      <span className="text-xs text-zinc-500">Đã ghi nhận lý do dismiss</span>
    );
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Dismiss có lý do
      </Button>
    );
  }

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiSend("POST", "/content/quality-warnings/dismiss", {
        targetType,
        targetId,
        gateName,
        detail: details.join("\n"),
        reason,
      });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Lý do chấp nhận/false positive"
        className="min-w-64 flex-1"
      />
      <Button
        size="sm"
        loading={saving}
        disabled={reason.trim().length < 3}
        onClick={submit}
      >
        Ghi nhận
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Hủy
      </Button>
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
    </div>
  );
}
