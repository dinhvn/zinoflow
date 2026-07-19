"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  destinationAiExtractionSchema,
  getDestinationAiExtractionResponseSchema,
  type DestinationAiExtractionFieldItem,
  type DestinationAiExtractionFieldKey,
  type DestinationOpeningHours,
  type PriceBreakdownItem,
} from "@zinoflow/contracts";
import { apiGet, apiSend } from "@/shared/api-client";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { ErrorBox } from "@/shared/ui/error-box";
import { Modal } from "@/shared/ui/modal";

const FIELD_LABELS: Record<DestinationAiExtractionFieldKey, string> = {
  name: "Tên",
  addressNew: "Địa chỉ mới (sau sáp nhập)",
  contactPhone: "Điện thoại",
  contactWebsite: "Website chính thức",
  shortDescription: "Mô tả ngắn",
  metaTitle: "Meta Title",
  openingHours: "Giờ mở cửa",
  aiReferenceSummary: "Tóm tắt cho AI viết bài",
  externalReviewUrl: "Link đánh giá ngoài",
  priceBreakdown: "Giá vé theo đối tượng",
  editorialReview: "Đánh giá biên tập",
};

function isOpeningHours(v: unknown): v is DestinationOpeningHours {
  return Boolean(v) && typeof v === "object" && "note" in (v as object);
}
function isReviewUrl(v: unknown): v is { label: string; url: string } {
  return Boolean(v) && typeof v === "object" && "url" in (v as object);
}
function isPriceBreakdown(v: unknown): v is PriceBreakdownItem[] {
  return Array.isArray(v) && v.every((i) => i && typeof i === "object" && "audience" in i);
}

/** Hien thi 1 gia tri field (string/openingHours/externalReviewUrl/priceBreakdown) — "—" khi rong. */
function formatFieldValue(v: unknown): string {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return "—";
  if (isOpeningHours(v)) {
    // Chi hien chi tiet periods khi co gio KHAC NHAU theo ngay (>1 period) — lich
    // deu deu hang ngay thi note da du, khong lap lai thong tin.
    if (v.periods.length <= 1) return v.note;
    const periods = v.periods.map((p) => `${p.days.join(",")} ${p.opens}-${p.closes}`).join("; ");
    return `${v.note} (${periods})`;
  }
  if (isReviewUrl(v)) return `${v.label}: ${v.url}`;
  if (isPriceBreakdown(v)) {
    return v
      .map((p) => `${p.audience}: ${p.price.toLocaleString("vi-VN")}đ${p.note ? ` (${p.note})` : ""}`)
      .join("\n");
  }
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

/**
 * Bang so sanh du lieu cu/moi tu skill "dichoithoi-extract-destination-info" (Claude
 * doc Google Maps + web tham khao, luu vao bang staging). Nguoi dung tick truong dung
 * roi bam "Chap nhan" de ghi de vao du lieu that — truong bo tick khong bi dong.
 * dichoithoi-destination-ai-extraction-plan.md §2.3.
 */
export function DestinationAiExtractionPanel({
  slug,
  onAccepted,
}: {
  slug: string;
  onAccepted: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<unknown>(null);

  const queryKey = ["destination-ai-extraction", slug];
  const extractionQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiGet(
        `/destinations/${slug}/ai-extraction`,
        getDestinationAiExtractionResponseSchema,
      );
      return res.extraction;
    },
  });
  const extraction = extractionQuery.data;

  const pendingCheckableIndexes = useMemo(() => {
    if (!extraction) return [];
    return extraction.fields
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f.found && f.status === "pending")
      .map(({ i }) => i);
  }, [extraction]);

  function openTable() {
    setChecked(new Set(pendingCheckableIndexes));
    setOpen(true);
  }

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const accept = useMutation({
    mutationFn: () =>
      apiSend("POST", `/destinations/${slug}/ai-extraction/accept`, {
        acceptedIndexes: [...checked],
      }),
    onSuccess: (data) => {
      setError(null);
      const parsed = destinationAiExtractionSchema.parse(data);
      queryClient.setQueryData(queryKey, parsed);
      setChecked(new Set());
      onAccepted();
    },
    onError: (e) => setError(e),
  });

  return (
    <div className="space-y-3">
      <div className="rounded bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-900">
        <p>
          Trang này <strong>chỉ xem và duyệt</strong> kết quả — KHÔNG có nút chạy trích xuất trong
          web CMS. Muốn trích xuất mới/lại, phải mở{" "}
          <strong>Claude Code (VS Code)</strong> ở thư mục dự án <code>zinoflow</code>
          (API zinoflow phải đang chạy local), rồi yêu cầu Claude — vd:
        </p>
        <p className="my-1 rounded bg-zinc-100 px-2 py-1 font-mono dark:bg-zinc-800">
          Trích xuất thông tin cho điểm đến {"<tên điểm đến>"}, Google Maps: {"<link>"}, web tham
          khảo: {"<link 1>"}, {"<link 2>"}...
        </p>
        <p>
          Claude sẽ tự nhận skill{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            dichoithoi-extract-destination-info
          </code>{" "}
          và đọc từng nguồn rồi lưu kết quả vào đây — dữ liệu CỨNG (SĐT/giờ mở cửa/địa chỉ) chỉ điền
          khi tìm thấy trong nguồn, không đoán. Chạy xong quay lại trang này, bấm &quot;Xem thông tin
          AI trích xuất&quot;, tick trường đúng rồi bấm &quot;Chấp nhận&quot; để ghi đè; trường bỏ
          tick giữ nguyên dữ liệu hiện tại. Trường đã chấp nhận trước đó vẫn tick lại được bình
          thường (vd nếu dữ liệu thật bị mất/sửa nhầm sau này) — nhãn &quot;Đã chấp nhận/Đã bỏ
          qua&quot; chỉ là gợi ý lần trước, không khoá.
        </p>
      </div>

      {error !== null && <ErrorBox error={error} />}
      {extractionQuery.isError && <ErrorBox error={extractionQuery.error} />}

      {extractionQuery.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}

      {!extractionQuery.isLoading && !extractionQuery.isError && !extraction && (
        <p className="text-sm text-zinc-500">
          Chưa có dữ liệu trích xuất AI cho điểm đến này — chạy skill trích xuất trước.
        </p>
      )}

      {extraction && (
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={openTable}>
            Xem thông tin AI trích xuất
          </Button>
          <span className="text-xs text-zinc-500">
            Trích xuất lúc {new Date(extraction.extractedAt).toLocaleString("vi-VN")} — nguồn:{" "}
            {extraction.sourceUrls.length}
          </span>
        </div>
      )}

      {extraction && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="So sánh dữ liệu AI trích xuất"
          width="max-w-5xl"
        >
          <div className="space-y-3">
            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                  <tr>
                    <th className="p-2">Trường</th>
                    <th className="p-2">Hiện tại</th>
                    <th className="p-2">AI trích xuất</th>
                    <th className="p-2 text-center">Áp dụng</th>
                    <th className="p-2">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {extraction.fields.map((field: DestinationAiExtractionFieldItem, i) => (
                    <tr key={i} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                      <td className="p-2 font-medium">{FIELD_LABELS[field.key]}</td>
                      <td className="whitespace-pre-line p-2 text-zinc-500">
                        {formatFieldValue(field.currentValue)}
                      </td>
                      <td className="whitespace-pre-line p-2">{formatFieldValue(field.newValue)}</td>
                      <td className="p-2 text-center">
                        {field.found ? (
                          <div className="flex flex-col items-center gap-1">
                            <Checkbox label="" checked={checked.has(i)} onChange={() => toggle(i)} />
                            {/* Chi la GOI Y trang thai lan truoc — KHONG khoa tick lai, cho phep
                                ap dung lai neu du lieu that bi mat/sua nham sau do (yeu cau nguoi
                                dung 07/2026). */}
                            {field.status !== "pending" && (
                              <Badge tone={field.status === "accepted" ? "emerald" : "gray"}>
                                {field.status === "accepted" ? "Đã chấp nhận" : "Đã bỏ qua"}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <Badge tone="gray">Không tìm thấy</Badge>
                        )}
                      </td>
                      <td className="p-2 text-xs text-zinc-500">{field.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={accept.isPending}
                disabled={checked.size === 0}
                onClick={() => accept.mutate()}
              >
                {accept.isPending ? "Đang chấp nhận..." : `Chấp nhận / áp dụng lại ${checked.size} mục đã tick`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Đóng
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
