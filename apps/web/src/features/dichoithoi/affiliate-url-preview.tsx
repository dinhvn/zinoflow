"use client";

import { useMutation } from "@tanstack/react-query";
import { resolveAffiliateLinkResponseSchema, type ResolveAffiliateLinkResponse } from "@zinoflow/contracts";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Badge, type BadgeTone } from "@/shared/ui/badge";

const LINK_STATUS_LABEL: Record<ResolveAffiliateLinkResponse["linkStatus"], string> = {
  converted: "Đã áp rule",
  "no-rule": "Chưa có rule khớp",
  "manual-override": "Sửa tay",
};

const LINK_STATUS_TONE: Record<ResolveAffiliateLinkResponse["linkStatus"], BadgeTone> = {
  converted: "emerald",
  "no-rule": "amber",
  "manual-override": "gray",
};

/**
 * Nut "Xem trước affiliateUrl" dùng chung cho mọi form nhập sourceUrl (Hotel,
 * Tour, Product, ticketLinks) — preview NGAY trong form trước khi lưu, đúng
 * yêu cầu affiliate-link-conversion-spec §5. Gọi lại `/affiliate/resolve`,
 * KHÔNG lưu gì — giá trị thật chỉ được tính lại và ghi khi submit form.
 */
export function AffiliateUrlPreview({
  sourceUrl,
  provider,
}: {
  sourceUrl: string;
  provider?: string | null;
}) {
  const preview = useMutation({
    mutationFn: async () =>
      resolveAffiliateLinkResponseSchema.parse(
        await apiSend("POST", "/affiliate/resolve", {
          sourceUrl: sourceUrl.trim(),
          provider: provider?.trim() || null,
        }),
      ),
  });

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="px-2 py-1 text-xs"
        disabled={!sourceUrl.trim() || preview.isPending}
        onClick={() => preview.mutate()}
      >
        {preview.isPending ? "Đang xem trước..." : "Xem trước affiliateUrl"}
      </Button>
      {preview.data && (
        <>
          <Badge tone={LINK_STATUS_TONE[preview.data.linkStatus]}>
            {LINK_STATUS_LABEL[preview.data.linkStatus]}
          </Badge>
          <a
            href={preview.data.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="max-w-xs truncate text-blue-600 hover:underline dark:text-blue-400"
          >
            {preview.data.affiliateUrl}
          </a>
        </>
      )}
      {preview.isError && (
        <span className="text-red-600 dark:text-red-400">
          {preview.error instanceof ApiError ? preview.error.message : String(preview.error)}
        </span>
      )}
    </div>
  );
}
