"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listDestinationsResponseSchema,
  type AffiliateLinkItem,
  type DestinationMirror,
} from "@zinoflow/contracts";
import { apiGet } from "@/shared/api-client";
import { Input } from "@/shared/ui/input";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { DataTable, type DataTableColumn } from "@/shared/ui/data-table";
import { Pagination } from "@/shared/ui/pagination";
import { Checkbox } from "@/shared/ui/checkbox";
import { Button } from "@/shared/ui/button";
import { PageHeader } from "@/shared/ui/page-header";
import { DestinationTicketLinksEditor } from "@/features/dichoithoi/destination-ticket-links-editor";
import { ImportTicketsModal } from "@/features/dichoithoi/import-tickets-modal";

const LINK_STATUS_TONE: Record<AffiliateLinkItem["linkStatus"], BadgeTone> = {
  converted: "emerald",
  "no-rule": "amber",
  "manual-override": "gray",
};

interface EditingDestination {
  slug: string;
  name: string;
}

/**
 * Trang quan ly "Vé" (link mua vé/booking) — nhin toan bo diem den thay vi
 * phai mo tung trang chi tiet. Tai su dung /destinations (tra ve ticketLinks +
 * ticketPrice cache san). Sua ve qua DestinationTicketLinksEditor — moi dong ve
 * la 1 ban ghi rieng trong bang destination_tickets (doc §11.5), khac Khach san/
 * Tour vi 1 diem den chi co 1 bo link vé gop chung trong 1 khoi sua.
 */
/** useSearchParams bat buoc nam trong Suspense o App Router (Next.js). */
export default function TicketsPage() {
  return (
    <Suspense>
      <TicketsPageContent />
    </Suspense>
  );
}

function TicketsPageContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  // Luu ca slug LAN ten — khong con phu thuoc diem dang mo co nam trong trang/
  // bo loc hien tai hay khong (truoc day chi tim duoc trong `items` cua trang
  // dang xem, nen khong co cach them ve cho diem bi loc/o trang khac).
  const [editingDestination, setEditingDestination] = useState<EditingDestination | null>(null);
  // Mac dinh AN diem mien phi/chua co gia — 166/272 diem la mien phi, gay nhieu
  // nut o trang nay khong can quan tam vé (doc §11.3)
  const [showAll, setShowAll] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: ["ve-destinations", search, page, pageSize, showAll],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        sortBy: "name",
        sortDir: "asc",
      });
      if (search) params.set("q", search);
      if (!showAll) params.set("hasTicketOpportunity", "true");
      return apiGet(`/destinations?${params}`, listDestinationsResponseSchema);
    },
  });

  const items = listQuery.data?.items ?? [];

  // Tu vao thang ban sua khi den tu link "Quan ly ve cho {ten}" o trang chi tiet
  // diem den (co ?q=, chi khop dung 1 dong) — khong can bam "Sua ve" them.
  useEffect(() => {
    if (!editingDestination && searchParams.get("q") && items.length === 1) {
      setEditingDestination({ slug: items[0]!.slug, name: items[0]!.name });
    }
  }, [items, editingDestination, searchParams]);

  function resetToFirstPage() {
    setPage(1);
  }

  const columns: DataTableColumn<DestinationMirror>[] = [
    {
      key: "name",
      header: "Điểm đến",
      render: (d) => (
        <div>
          <div className="font-medium text-zinc-900 dark:text-zinc-100">{d.name}</div>
          <div className="text-xs text-zinc-500">{d.provinceName ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "ticketPrice",
      header: "Giá tại quầy",
      render: (d) =>
        d.ticketPrice ? (
          <span className="text-sm">{d.ticketPrice}</span>
        ) : (
          <span className="text-xs text-zinc-400">—</span>
        ),
    },
    {
      key: "ticketLinks",
      header: "Số link vé",
      align: "center",
      render: (d) => <Badge tone={d.ticketLinks.length > 0 ? "emerald" : "gray"}>{d.ticketLinks.length}</Badge>,
    },
    {
      key: "linkStatus",
      header: "Trạng thái link",
      render: (d) =>
        d.ticketLinks.length === 0 ? (
          <span className="text-xs text-zinc-400">Chưa có link</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {d.ticketLinks.map((link, i) => (
              <Badge key={i} tone={LINK_STATUS_TONE[link.linkStatus]}>
                {link.provider}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (d) => (
        <button
          type="button"
          onClick={() =>
            setEditingDestination(
              editingDestination?.slug === d.slug ? null : { slug: d.slug, name: d.name },
            )
          }
          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {editingDestination?.slug === d.slug ? "Đóng" : "Sửa vé"}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vé"
        description="Quản lý link mua vé (Klook, TripVision...) của mọi điểm đến ở 1 chỗ. Ưu tiên nhóm đã có giá tại quầy nhưng chưa có link mua online (cơ hội hoa hồng đang bỏ lỡ)."
        actions={
          <Button size="sm" className="whitespace-nowrap" onClick={() => setImportOpen(true)}>
            Nhập từ Sheet
          </Button>
        }
      />

      <ImportTicketsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["ve-destinations"] })}
      />

      <AddTicketDestinationPicker onPick={setEditingDestination} />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetToFirstPage();
          }}
          placeholder="Tìm điểm đến..."
          className="max-w-sm"
        />
        <Checkbox
          label="Hiện cả điểm miễn phí/chưa có giá"
          checked={showAll}
          onChange={(e) => setShowAll(e.target.checked)}
        />
      </div>

      <DataTable
        columns={columns}
        items={items}
        rowKey={(d) => d.slug}
        loading={listQuery.isLoading}
      />

      {listQuery.data && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={listQuery.data.total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            resetToFirstPage();
          }}
        />
      )}

      {editingDestination && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Link mua vé — {editingDestination.name}
          </h2>
          <DestinationTicketLinksEditor
            slug={editingDestination.slug}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["ve-destinations"] })}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Tim + mo editor cho BAT KY diem den nao — khong phu thuoc bo loc/trang hien
 * tai cua bang chinh (vd diem mien phi bi an mac dinh, hoac nam o trang khac).
 * Day la loi vao "+ Thêm vé mới" that su cua trang nay.
 */
function AddTicketDestinationPicker({ onPick }: { onPick: (d: EditingDestination) => void }) {
  const [q, setQ] = useState("");
  const pickerQuery = useQuery({
    queryKey: ["ve-destination-picker", q],
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", limit: "8", sortBy: "name", sortDir: "asc", q });
      return apiGet(`/destinations?${params}`, listDestinationsResponseSchema);
    },
    enabled: q.trim().length >= 2,
  });

  return (
    <div className="rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
      <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        + Thêm vé cho điểm đến khác (kể cả điểm miễn phí đang bị ẩn ở bảng dưới)
      </p>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Gõ tên điểm đến (tối thiểu 2 ký tự)..."
        className="max-w-sm"
      />
      {q.trim().length >= 2 && (
        <div className="mt-2 max-h-56 divide-y divide-zinc-100 overflow-y-auto rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {pickerQuery.isLoading && <p className="p-2 text-xs text-zinc-400">Đang tìm...</p>}
          {pickerQuery.data?.items.map((d) => (
            <button
              key={d.slug}
              type="button"
              onClick={() => {
                onPick({ slug: d.slug, name: d.name });
                setQ("");
              }}
              className="flex w-full items-center justify-between gap-2 p-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span>
                {d.name} <span className="text-xs text-zinc-400">({d.provinceName ?? "—"})</span>
              </span>
              <span className="text-xs text-zinc-400">{d.ticketLinks.length} link vé</span>
            </button>
          ))}
          {pickerQuery.data?.items.length === 0 && (
            <p className="p-2 text-xs text-zinc-400">Không tìm thấy điểm đến nào.</p>
          )}
        </div>
      )}
    </div>
  );
}
