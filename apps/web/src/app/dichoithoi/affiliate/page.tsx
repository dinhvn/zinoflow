"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import {
  affiliateNetworkSchema,
  affiliatePartnerSchema,
  affiliatePlaceholderSchema,
  fetchSheetResponseSchema,
  importAffiliatePartnersResultSchema,
  type AffiliateNetwork,
  type AffiliatePartner,
  type AffiliatePlaceholder,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { Modal } from "@/shared/ui/modal";
import { PageHeader } from "@/shared/ui/page-header";
import { emptyToUndef, parseRowsFromText } from "@/features/dichoithoi/sheet-import-csv";

const EMPTY_NETWORK_FORM = {
  code: "",
  name: "",
  template: "",
  placeholder: "{url_enc}" as AffiliatePlaceholder,
  isActive: true,
  notes: "",
};

const EMPTY_PARTNER_FORM = {
  code: "",
  name: "",
  homepageUrl: "",
  description: "",
  matchDomain: "",
  networkId: "" as string,
  isActive: true,
};

/**
 * Man "Affiliate" gom 2 khu vuc (doc affiliate-provider-management-analysis):
 * Mạng affiliate (template dùng chung 1 mạng, vd Accesstrade) + Đối tác affiliate
 * (klook/vexere/booking..., gán vào 1 mạng qua dropdown, nguồn dropdown provider
 * cho ticketLinks/Hotel/Tour). Import hàng loạt đối tác từ Google Sheet public —
 * lưu thẳng, không preview.
 */
export default function AffiliatePage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Affiliate"
        description="Quản lý mạng affiliate (template chung) và danh sách đối tác (klook/vexere/booking...). Đối tác là nguồn dropdown provider bắt buộc khi nhập link ở Vé/Khách sạn/Tour."
      />
      <NetworksSection />
      <PartnersSection />
    </div>
  );
}

function NetworksSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_NETWORK_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reapplyMsg, setReapplyMsg] = useState<string | null>(null);

  const networksQuery = useQuery({
    queryKey: ["affiliate-networks"],
    queryFn: () => apiGet("/affiliate/networks", z.array(affiliateNetworkSchema)),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        template: form.template.trim(),
        placeholder: form.placeholder,
        isActive: form.isActive,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        return affiliateNetworkSchema.parse(
          await apiSend("PATCH", `/affiliate/networks/${editingId}`, body),
        );
      }
      return affiliateNetworkSchema.parse(await apiSend("POST", "/affiliate/networks", body));
    },
    onSuccess: () => {
      setError(null);
      setForm(EMPTY_NETWORK_FORM);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["affiliate-networks"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  // Ap dung lai qua pg-boss (fire-and-forget) — khong con tra tong hop ngay lap tuc
  const reapply = useMutation({
    mutationFn: async () => apiSend("POST", "/affiliate/reapply", { ruleId: null }),
    onSuccess: () => {
      setError(null);
      setReapplyMsg("Đã đưa vào hàng đợi — link sẽ được cập nhật trong giây lát.");
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiSend("DELETE", `/affiliate/networks/${id}`),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["affiliate-networks"] });
      queryClient.invalidateQueries({ queryKey: ["affiliate-partners"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  function startEdit(network: AffiliateNetwork) {
    setEditingId(network.id);
    setForm({
      code: network.code,
      name: network.name,
      template: network.template,
      placeholder: network.placeholder,
      isActive: network.isActive,
      notes: network.notes ?? "",
    });
  }

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">Mạng affiliate</h3>
      <p className="text-sm text-zinc-500">
        Vd Accesstrade — 1 template deep-link dùng chung cho MỌI đối tác gán vào mạng này. Sửa
        template không cần deploy — bấm &quot;Áp dụng lại toàn bộ&quot; để cập nhật link cũ.
      </p>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      {reapplyMsg && (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {reapplyMsg}
        </div>
      )}

      <div className="rounded border border-zinc-300 p-4 dark:border-zinc-700">
        <h4 className="mb-3 font-medium">{editingId ? "Sửa mạng" : "Thêm mạng mới"}</h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            placeholder="code (vd: accesstrade)"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          />
          <Input
            placeholder="Tên hiển thị (vd: Accesstrade)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            className="md:col-span-2"
            placeholder="template (vd: https://go.isclix.com/deep_link/...?url={url_enc})"
            value={form.template}
            onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}
          />
          <Select
            value={form.placeholder}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                placeholder: affiliatePlaceholderSchema.parse(e.target.value),
              }))
            }
          >
            <option value="{url_enc}">{"{url_enc}"} — URL-encode</option>
            <option value="{url}">{"{url}"} — giữ nguyên</option>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Đang bật
          </label>
          <Input
            className="md:col-span-2"
            placeholder="Ghi chú (tuỳ chọn)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!form.code.trim() || !form.name.trim() || !form.template.trim()}
            onClick={() => save.mutate()}
          >
            {editingId ? "Lưu mạng" : "Thêm mạng"}
          </Button>
          {editingId && (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_NETWORK_FORM);
              }}
            >
              Huỷ sửa
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {networksQuery.data?.map((network) => (
          <div
            key={network.id}
            className="flex items-center justify-between rounded border border-zinc-300 p-3 dark:border-zinc-700"
          >
            <div className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{network.name}</span>
                <span className="text-xs text-zinc-400">({network.code})</span>
                <Badge tone={network.isActive ? "emerald" : "gray"}>
                  {network.isActive ? "Đang bật" : "Đã tắt"}
                </Badge>
              </div>
              <div className="truncate text-xs text-zinc-500">{network.template}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => startEdit(network)}>
                Sửa
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={remove.isPending}
                onClick={() => {
                  if (confirm(`Xoá mạng "${network.name}"? Đối tác đang gán mạng này sẽ về "chưa gán mạng".`)) {
                    remove.mutate(network.id);
                  }
                }}
              >
                Xoá
              </Button>
            </div>
          </div>
        ))}
        {networksQuery.data?.length === 0 && (
          <p className="text-sm text-zinc-500">Chưa có mạng affiliate nào.</p>
        )}
      </div>

      <Button size="sm" variant="secondary" loading={reapply.isPending} onClick={() => reapply.mutate()}>
        Áp dụng lại TOÀN BỘ (mọi mạng)
      </Button>
    </section>
  );
}

interface PartnerRow {
  code: string;
  name: string;
  homepageUrl?: string;
  description?: string;
  networkCode?: string;
  isActive?: string;
}

const DEFAULT_PARTNERS_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1dj2Zwb496l6rTJykOpMYLyP8syD13Bv4MFrIi9fgIpo/edit?gid=0#gid=0";

function rowFromObject(o: Record<string, string>): PartnerRow {
  return {
    code: (o.code ?? "").trim(),
    name: (o.name ?? "").trim(),
    homepageUrl: emptyToUndef(o.link ?? o.homepageUrl),
    description: emptyToUndef(o.desc ?? o.description),
    // "affiliate_network" trong Sheet CHÍNH LÀ code của affiliate_networks — khớp chính xác
    networkCode: emptyToUndef(o.affiliate_network ?? o.networkCode),
    isActive: emptyToUndef(o.status),
  };
}

/** true trừ khi giá trị đúng là "0"/"false" (không phân biệt hoa thường) */
function parseActiveFlag(raw: string | undefined): boolean {
  if (!raw) return true;
  return !/^(0|false)$/i.test(raw.trim());
}

const CSV_HEADERS = ["code", "name", "link", "desc", "affiliate_network", "status"] as const;

function PartnersSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_PARTNER_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState(DEFAULT_PARTNERS_SHEET_URL);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const networksQuery = useQuery({
    queryKey: ["affiliate-networks"],
    queryFn: () => apiGet("/affiliate/networks", z.array(affiliateNetworkSchema)),
  });
  const partnersQuery = useQuery({
    queryKey: ["affiliate-partners"],
    queryFn: () => apiGet("/affiliate/partners", z.array(affiliatePartnerSchema)),
  });
  const networkById = new Map((networksQuery.data ?? []).map((n) => [n.id, n]));

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        homepageUrl: form.homepageUrl.trim() || null,
        description: form.description.trim() || null,
        matchDomain: form.matchDomain.trim() || null,
        networkId: form.networkId || null,
        isActive: form.isActive,
      };
      if (editingId) {
        return affiliatePartnerSchema.parse(
          await apiSend("PATCH", `/affiliate/partners/${editingId}`, body),
        );
      }
      return affiliatePartnerSchema.parse(await apiSend("POST", "/affiliate/partners", body));
    },
    onSuccess: () => {
      setError(null);
      setForm(EMPTY_PARTNER_FORM);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["affiliate-partners"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  const assignNetwork = useMutation({
    mutationFn: async ({ id, networkId }: { id: string; networkId: string | null }) =>
      affiliatePartnerSchema.parse(await apiSend("PATCH", `/affiliate/partners/${id}`, { networkId })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["affiliate-partners"] }),
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  const removePartner = useMutation({
    mutationFn: async (id: string) => apiSend("DELETE", `/affiliate/partners/${id}`),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["affiliate-partners"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  const importSheet = useMutation({
    mutationFn: async () => {
      const { csv } = fetchSheetResponseSchema.parse(
        await apiSend("POST", "/affiliate/fetch-sheet", { url: sheetUrl.trim() }),
      );
      const rows = parseRowsFromText(csv).map(rowFromObject);
      const items = rows
        .filter((r) => r.code && r.name)
        .map((r) => ({
          code: r.code,
          name: r.name,
          homepageUrl: r.homepageUrl ?? null,
          description: r.description ?? null,
          networkCode: r.networkCode ?? null,
          isActive: parseActiveFlag(r.isActive),
        }));
      if (items.length === 0) throw new Error("Không đọc được dòng nào hợp lệ (cần cột code + name)");
      return importAffiliatePartnersResultSchema.parse(
        await apiSend("POST", "/affiliate/partners/import", { items }),
      );
    },
    onSuccess: (result) => {
      setError(null);
      setImportMsg(
        `Đã đồng bộ: ${result.inserted} mới, ${result.updated} cập nhật` +
          (result.skipped.length > 0 ? `, ${result.skipped.length} bỏ qua` : ""),
      );
      queryClient.invalidateQueries({ queryKey: ["affiliate-partners"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  function startEdit(partner: AffiliatePartner) {
    setEditingId(partner.id);
    setForm({
      code: partner.code,
      name: partner.name,
      homepageUrl: partner.homepageUrl ?? "",
      description: partner.description ?? "",
      matchDomain: partner.matchDomain ?? "",
      networkId: partner.networkId ?? "",
      isActive: partner.isActive,
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Đối tác affiliate</h3>
          <p className="text-sm text-zinc-500">
            Danh sách klook/vexere/booking... — <strong>code</strong> phải khớp đúng giá trị
            provider dùng ở Vé/Khách sạn/Tour. Có thể chọn mạng ngay khi thêm mới, hoặc gán/sửa
            lại sau qua dropdown ở mỗi dòng bên dưới.
          </p>
        </div>
        <Button size="sm" className="whitespace-nowrap" onClick={() => setImportOpen(true)}>
          Nhập từ Sheet
        </Button>
      </div>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Nhập đối tác từ Google Sheet">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
              className="flex-1"
            />
            <Button
              variant="primary"
              className="whitespace-nowrap"
              loading={importSheet.isPending}
              disabled={!sheetUrl.trim()}
              onClick={() => sheetUrl.trim() && importSheet.mutate()}
            >
              Đồng bộ (lưu thẳng)
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            Sheet phải để công khai (Bất kỳ ai có link — Người xem). Cột hỗ trợ:{" "}
            {CSV_HEADERS.join(", ")} — cột &quot;affiliate_network&quot; = code mạng affiliate
            (khớp chính xác, không khớp được thì giữ nguyên gán cũ). Cột &quot;status&quot;: để
            trống hoặc bất kỳ giá trị nào khác &quot;0&quot;/&quot;false&quot; = đang bật.
          </p>
          {importSheet.isError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {importSheet.error instanceof ApiError ? importSheet.error.message : String(importSheet.error)}
            </p>
          )}
          {importMsg && <p className="text-sm text-emerald-700 dark:text-emerald-400">✅ {importMsg}</p>}
        </div>
      </Modal>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded border border-zinc-300 p-4 dark:border-zinc-700">
        <h4 className="mb-3 font-medium">{editingId ? "Sửa đối tác" : "Thêm đối tác mới"}</h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            placeholder="code (vd: klook)"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          />
          <Input
            placeholder="Tên hiển thị (vd: Klook)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            placeholder="Link trang chủ (tuỳ chọn)"
            value={form.homepageUrl}
            onChange={(e) => setForm((f) => ({ ...f, homepageUrl: e.target.value }))}
          />
          <Input
            placeholder="match_domain — gợi ý UX khi nhập link (vd: klook.com)"
            value={form.matchDomain}
            onChange={(e) => setForm((f) => ({ ...f, matchDomain: e.target.value }))}
          />
          <Select
            value={form.networkId}
            onChange={(e) => setForm((f) => ({ ...f, networkId: e.target.value }))}
          >
            <option value="">— chưa gán mạng —</option>
            {networksQuery.data?.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </Select>
          <Input
            className="md:col-span-2"
            placeholder="Mô tả (tuỳ chọn)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Đang bật
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!form.code.trim() || !form.name.trim()}
            onClick={() => save.mutate()}
          >
            {editingId ? "Lưu đối tác" : "Thêm đối tác"}
          </Button>
          {editingId && (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_PARTNER_FORM);
              }}
            >
              Huỷ sửa
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {partnersQuery.data?.map((partner) => (
          <div
            key={partner.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-300 p-3 dark:border-zinc-700"
          >
            <div className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{partner.name}</span>
                <span className="text-xs text-zinc-400">({partner.code})</span>
                <Badge tone={partner.isActive ? "emerald" : "gray"}>
                  {partner.isActive ? "Đang bật" : "Đã tắt"}
                </Badge>
                {!partner.networkId && <Badge tone="amber">Chưa gán mạng</Badge>}
              </div>
              {partner.description && (
                <div className="text-xs text-zinc-500">{partner.description}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={partner.networkId ?? ""}
                onChange={(e) =>
                  assignNetwork.mutate({ id: partner.id, networkId: e.target.value || null })
                }
              >
                <option value="">— chưa gán mạng —</option>
                {networksQuery.data?.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={() => startEdit(partner)}>
                Sửa
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={removePartner.isPending}
                onClick={() => {
                  if (confirm(`Xoá đối tác "${partner.name}"?`)) removePartner.mutate(partner.id);
                }}
              >
                Xoá
              </Button>
            </div>
          </div>
        ))}
        {partnersQuery.data?.length === 0 && (
          <p className="text-sm text-zinc-500">Chưa có đối tác nào.</p>
        )}
      </div>
      {networkById.size === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Chưa có mạng affiliate nào — thêm mạng ở mục trên trước khi gán cho đối tác.
        </p>
      )}
    </section>
  );
}
