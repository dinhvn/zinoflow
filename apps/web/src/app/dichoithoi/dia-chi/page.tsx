"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addressMappingProvincesSchema,
  addressMappingsResponseSchema,
} from "@zinoflow/contracts";
import { apiGet } from "@/shared/api-client";

/**
 * Tra cuu dia chi cu -> moi sau sap nhap don vi hanh chinh 2025.
 * Du lieu tu bang admin_ward_mappings (seed dvhcvn) — chi doc.
 */
export default function DiaChiPage() {
  const [search, setSearch] = useState("");
  const [oldProvince, setOldProvince] = useState("");
  const [newProvince, setNewProvince] = useState("");
  const [page, setPage] = useState(1);

  const provincesQuery = useQuery({
    queryKey: ["address-mapping-provinces"],
    queryFn: () =>
      apiGet("/destinations/address-mappings/provinces", addressMappingProvincesSchema),
    staleTime: 10 * 60 * 1000,
  });

  const listQuery = useQuery({
    queryKey: ["address-mappings", search, oldProvince, newProvince, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) params.set("q", search);
      if (oldProvince) params.set("oldProvinceName", oldProvince);
      if (newProvince) params.set("newProvinceName", newProvince);
      return apiGet(`/destinations/address-mappings?${params}`, addressMappingsResponseSchema);
    },
  });

  const data = listQuery.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Tra cứu địa chỉ cũ → mới</h2>
        <p className="text-sm text-zinc-500">
          Đối chiếu phường/xã trước và sau sáp nhập đơn vị hành chính. Dữ liệu nội bộ (dvhcvn),
          chỉ để tra cứu — không ảnh hưởng tới điểm đến.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Tìm theo tên phường/xã, quận/huyện (gõ có dấu)..."
          className="w-72 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={oldProvince}
          onChange={(e) => {
            setOldProvince(e.target.value);
            setPage(1);
          }}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Tỉnh/thành cũ (tất cả)</option>
          {provincesQuery.data?.oldProvinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={newProvince}
          onChange={(e) => {
            setNewProvince(e.target.value);
            setPage(1);
          }}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Tỉnh/thành mới (tất cả)</option>
          {provincesQuery.data?.newProvinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {listQuery.isLoading && <p className="text-sm text-zinc-500">Đang tải...</p>}
      {listQuery.isError && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {listQuery.error instanceof Error ? listQuery.error.message : "Lỗi tải danh sách"}
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="rounded border border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
          Không tìm thấy địa chỉ phù hợp.
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2 font-medium" colSpan={3}>
                    Địa chỉ cũ (trước sáp nhập)
                  </th>
                  <th className="border-l border-zinc-200 px-3 py-2 font-medium dark:border-zinc-800" colSpan={2}>
                    Địa chỉ mới (sau sáp nhập)
                  </th>
                </tr>
                <tr className="text-xs text-zinc-500">
                  <th className="px-3 py-1.5 font-medium">Phường/Xã</th>
                  <th className="px-3 py-1.5 font-medium">Quận/Huyện</th>
                  <th className="px-3 py-1.5 font-medium">Tỉnh/Thành</th>
                  <th className="border-l border-zinc-200 px-3 py-1.5 font-medium dark:border-zinc-800">
                    Phường/Xã
                  </th>
                  <th className="px-3 py-1.5 font-medium">Tỉnh/Thành</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <td className="px-3 py-2">{m.oldWardName ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-500">{m.oldDistrictName ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-500">{m.oldProvinceName ?? "—"}</td>
                    <td className="border-l border-zinc-200 px-3 py-2 font-medium dark:border-zinc-800">
                      {m.newWardName ?? "—"}
                    </td>
                    <td className="px-3 py-2">{m.newProvinceName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>
              {data.total.toLocaleString("vi-VN")} bản ghi — trang {data.page}/{totalPages}
            </span>
            <div className="space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
              >
                ← Trước
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
              >
                Sau →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
