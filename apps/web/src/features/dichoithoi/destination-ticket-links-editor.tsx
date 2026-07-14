"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import {
  affiliatePartnerSchema,
  destinationTicketSchema,
  type AffiliatePartner,
  type DestinationTicket,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { AffiliateUrlPreview } from "./affiliate-url-preview";

const LINK_STATUS_LABEL: Record<DestinationTicket["linkStatus"], string> = {
  converted: "Đã áp rule",
  "no-rule": "Chưa có rule khớp",
  "manual-override": "Sửa tay",
};

const LINK_STATUS_TONE: Record<DestinationTicket["linkStatus"], BadgeTone> = {
  converted: "emerald",
  "no-rule": "amber",
  "manual-override": "gray",
};

const EMPTY_NEW_ROW = { provider: "", label: "", sourceUrl: "", price: "" };

/**
 * Sua danh sach ve (Klook, TripVision...) cho 1 diem den — moi dong la 1 ban
 * ghi rieng trong bang destination_tickets (doc §11.5, thay ticketLinks[] nhung),
 * sua/xoa TUNG dong qua API rieng. provider bat buoc chon tu danh sach Doi tac
 * affiliate (khong con nhap tay tu do — doc affiliate-provider-management §5).
 */
export function DestinationTicketLinksEditor({
  slug,
  onSaved,
}: {
  slug: string;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [newRow, setNewRow] = useState(EMPTY_NEW_ROW);
  const [error, setError] = useState<string | null>(null);

  const partnersQuery = useQuery({
    queryKey: ["affiliate-partners"],
    queryFn: () => apiGet("/affiliate/partners", z.array(affiliatePartnerSchema)),
  });
  const activePartners = (partnersQuery.data ?? []).filter((p) => p.isActive);

  const ticketsQuery = useQuery({
    queryKey: ["destination-tickets", slug],
    queryFn: () => apiGet(`/destinations/${slug}/tickets`, z.array(destinationTicketSchema)),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["destination-tickets", slug] });
    onSaved?.();
  }

  const create = useMutation({
    mutationFn: async () =>
      destinationTicketSchema.parse(
        await apiSend("POST", `/destinations/${slug}/tickets`, {
          provider: newRow.provider,
          label: newRow.label.trim() || null,
          sourceUrl: newRow.sourceUrl.trim(),
          price: newRow.price.trim() ? Number(newRow.price) : null,
        }),
      ),
    onSuccess: () => {
      setError(null);
      setNewRow(EMPTY_NEW_ROW);
      invalidate();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiSend("DELETE", `/tickets/${id}`),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Chọn đối tác bán vé + dán link gốc — link affiliate được tự sinh theo mạng affiliate đã
        gán cho đối tác đó (mục &quot;Affiliate&quot;).
      </p>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {ticketsQuery.data?.map((ticket) => (
          <div key={ticket.id} className="rounded border border-zinc-300 p-2 dark:border-zinc-700">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{ticket.label || ticket.provider}</span>
              <Badge tone={LINK_STATUS_TONE[ticket.linkStatus]}>
                {LINK_STATUS_LABEL[ticket.linkStatus]}
              </Badge>
              {ticket.price != null && (
                <span className="text-xs text-zinc-500">{ticket.price.toLocaleString("vi-VN")}đ</span>
              )}
              <a
                href={ticket.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="max-w-xs truncate text-blue-600 hover:underline dark:text-blue-400"
              >
                {ticket.affiliateUrl}
              </a>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto px-2 py-1 text-xs"
                loading={remove.isPending}
                onClick={() => remove.mutate(ticket.id)}
              >
                Xoá
              </Button>
            </div>
          </div>
        ))}
        {ticketsQuery.data?.length === 0 && (
          <p className="text-sm text-zinc-400">Chưa có link vé nào.</p>
        )}
      </div>

      <div className="rounded border border-zinc-300 p-2 dark:border-zinc-700">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <Select
            value={newRow.provider}
            onChange={(e) => setNewRow((r) => ({ ...r, provider: e.target.value }))}
          >
            <option value="">— chọn đối tác —</option>
            {activePartners.map((p: AffiliatePartner) => (
              <option key={p.id} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
          <Input
            value={newRow.label}
            onChange={(e) => setNewRow((r) => ({ ...r, label: e.target.value }))}
            placeholder="Nhãn hiển thị (tuỳ chọn)"
          />
          <Input
            value={newRow.sourceUrl}
            onChange={(e) => setNewRow((r) => ({ ...r, sourceUrl: e.target.value }))}
            placeholder="https://... (link gốc)"
          />
          <Input
            type="number"
            min={0}
            value={newRow.price}
            onChange={(e) => setNewRow((r) => ({ ...r, price: e.target.value }))}
            placeholder="Giá tham khảo (tuỳ chọn)"
          />
        </div>
        <div className="mt-2">
          <AffiliateUrlPreview sourceUrl={newRow.sourceUrl} provider={newRow.provider} />
        </div>
        {activePartners.length === 0 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Chưa có đối tác affiliate nào —{" "}
            <a href="/dichoithoi/affiliate" className="underline">
              thêm ở mục Affiliate
            </a>{" "}
            trước.
          </p>
        )}
        <div className="mt-2">
          <Button
            size="sm"
            variant="primary"
            loading={create.isPending}
            disabled={!newRow.provider || !newRow.sourceUrl.trim()}
            onClick={() => create.mutate()}
          >
            + Thêm link vé
          </Button>
        </div>
      </div>
    </div>
  );
}
