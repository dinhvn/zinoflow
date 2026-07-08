"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod/v4";
import { affiliateLinkItemSchema, type AffiliateLinkItem } from "@zinoflow/contracts";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";

interface Row {
  provider: string;
  label: string;
  sourceUrl: string;
  price: string;
}

const LINK_STATUS_LABEL: Record<AffiliateLinkItem["linkStatus"], string> = {
  converted: "Đã áp rule",
  "no-rule": "Chưa có rule khớp",
  "manual-override": "Sửa tay",
};

const LINK_STATUS_TONE: Record<AffiliateLinkItem["linkStatus"], BadgeTone> = {
  converted: "emerald",
  "no-rule": "amber",
  "manual-override": "gray",
};

function toRows(links: readonly AffiliateLinkItem[]): Row[] {
  return links.map((l) => ({
    provider: l.provider,
    label: l.label ?? "",
    sourceUrl: l.sourceUrl,
    price: l.price != null ? String(l.price) : "",
  }));
}

/**
 * Sua danh sach link mua ve (Klook, TripVision...) — chi nhap provider/label/
 * sourceUrl, affiliateUrl do server tinh qua AffiliateLinkResolver luc luu
 * (affiliate-link-conversion-spec §5). Luu rieng, khong qua form metadata chung.
 */
export function DestinationTicketLinksEditor({
  slug,
  ticketLinks,
  onSaved,
}: {
  slug: string;
  ticketLinks: AffiliateLinkItem[];
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(toRows(ticketLinks));
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        ticketLinks: rows
          .filter((r) => r.sourceUrl.trim())
          .map((r) => ({
            provider: r.provider.trim() || "other",
            label: r.label.trim() || null,
            sourceUrl: r.sourceUrl.trim(),
            price: r.price.trim() ? Number(r.price) : null,
          })),
      };
      return z
        .array(affiliateLinkItemSchema)
        .parse(await apiSend("POST", `/destinations/${slug}/ticket-links`, body));
    },
    onSuccess: (saved) => {
      setError(null);
      setRows(toRows(saved));
      onSaved();
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { message: e.message, details: e.details }
          : { message: String(e), details: [] },
      ),
  });

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Chỉ nhập link gốc (sourceUrl) — link affiliate được tự sinh theo quy tắc ở mục &quot;Quy
        tắc affiliate&quot;.
      </p>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">{error.message}</p>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((row, i) => {
          const saved = ticketLinks[i];
          return (
            <div key={i} className="rounded border border-zinc-300 p-2 dark:border-zinc-700">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <Input
                  value={row.provider}
                  onChange={(e) => update(i, { provider: e.target.value })}
                  placeholder="provider (vd: klook)"
                />
                <Input
                  value={row.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Nhãn hiển thị (tuỳ chọn)"
                />
                <Input
                  value={row.sourceUrl}
                  onChange={(e) => update(i, { sourceUrl: e.target.value })}
                  placeholder="https://... (link gốc)"
                />
                <Input
                  type="number"
                  min={0}
                  value={row.price}
                  onChange={(e) => update(i, { price: e.target.value })}
                  placeholder="Giá tham khảo (tuỳ chọn)"
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                {saved && saved.sourceUrl === row.sourceUrl.trim() ? (
                  <div className="flex items-center gap-2 text-xs">
                    <Badge tone={LINK_STATUS_TONE[saved.linkStatus]}>
                      {LINK_STATUS_LABEL[saved.linkStatus]}
                    </Badge>
                    <a
                      href={saved.affiliateUrl}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="truncate text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {saved.affiliateUrl}
                    </a>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-400">Chưa lưu</span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Xoá
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="px-2 py-1 text-xs"
          onClick={() =>
            setRows((prev) => [...prev, { provider: "", label: "", sourceUrl: "", price: "" }])
          }
        >
          + Thêm link
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Đang lưu..." : "Lưu link vé"}
        </Button>
      </div>
    </div>
  );
}
