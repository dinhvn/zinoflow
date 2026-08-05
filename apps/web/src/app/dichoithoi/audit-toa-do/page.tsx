"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { auditDestinationDuplicatesClusterFitReportSchema } from "@zinoflow/contracts";
import { apiGet } from "@/shared/api-client";
import { PageHeader } from "@/shared/ui/page-header";
import { Slider } from "@/shared/ui/slider";
import { FeatureIntro } from "@/shared/ui";
import { ErrorBox } from "@/shared/ui/error-box";

/**
 * Giai doan 2 (dichoithoi-destination-geocode-audit-plan.md) — bao cao DOC
 * trung lap/sai cum dua tren toa do that (Haversine), CHUA co hanh dong hang
 * loat vi nguong khoang cach chua duoc chot (quyet dinh 05/08/2026: "de xem
 * tinh hinh du lieu that truoc"). Nguoi dung tu chinh nguong bang slider, tu
 * sua tay qua trang chi tiet diem den (doi Cum/Tinh cha, hoac xoa diem trung).
 */
export default function AuditToaDoPage() {
  const [duplicateThresholdMeters, setDuplicateThresholdMeters] = useState(150);
  const [clusterFitRatio, setClusterFitRatio] = useState(0.5);

  const query = useQuery({
    queryKey: ["destination-audit-duplicates-cluster-fit", duplicateThresholdMeters, clusterFitRatio],
    queryFn: () =>
      apiGet(
        `/destinations/audit/duplicates-cluster-fit?duplicateThresholdMeters=${duplicateThresholdMeters}&clusterFitRatio=${clusterFitRatio}`,
        auditDestinationDuplicatesClusterFitReportSchema,
      ),
  });
  const data = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rà soát trùng lặp & sai cụm (theo toạ độ thật)"
        description="So khoảng cách thật giữa các điểm đến đã có toạ độ — phát hiện điểm nghi trùng lặp hoặc gán sai cụm."
      />

      <FeatureIntro
        summary={
          <>
            Công cụ này CHỈ hiện báo cáo để bạn xem — không tự gộp/xoá/đổi cụm gì. Ngưỡng dưới đây
            CHƯA được chốt cố định (05/08/2026), tự chỉnh theo dữ liệu thật rồi tự sửa tay từng
            trường hợp qua trang chi tiết điểm đến (đổi Cụm/Tỉnh cha, hoặc xoá điểm trùng).
          </>
        }
        details={
          <div className="space-y-1.5">
            <p>
              <strong>Nghi trùng lặp</strong>: 2 điểm CÙNG 1 cụm cha, khoảng cách thẳng (đường chim
              bay) dưới ngưỡng bạn chọn — càng gần càng chắc là trùng.
            </p>
            <p>
              <strong>Nghi sai cụm</strong>: 1 điểm có cụm/tỉnh KHÁC gần hơn cụm đang gán hiện tại
              (theo tỷ lệ bạn chọn — vd 0.5 = cụm khác phải gần hơn ít nhất 2 lần mới bị gắn cờ).
            </p>
            <p className="text-zinc-400">
              Chỉ tính được cho điểm ĐÃ CÓ toạ độ (googleMapsUrl hợp lệ) — dùng{" "}
              <Link href="/dichoithoi?missingCoords=true" className="underline">
                "Tìm toạ độ hàng loạt"
              </Link>{" "}
              trước cho các điểm còn thiếu để báo cáo này đầy đủ hơn.
            </p>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded border border-zinc-200 p-4 dark:border-zinc-800 md:grid-cols-2">
        <Slider
          label="Ngưỡng nghi trùng lặp"
          min={20}
          max={1000}
          step={10}
          value={duplicateThresholdMeters}
          display={`${duplicateThresholdMeters}m`}
          onChange={(e) => setDuplicateThresholdMeters(Number(e.target.value))}
        />
        <Slider
          label="Tỷ lệ nghi sai cụm (cụm khác phải gần hơn tối thiểu)"
          min={0.1}
          max={0.9}
          step={0.05}
          value={clusterFitRatio}
          display={`${Math.round((1 / clusterFitRatio) * 10) / 10} lần`}
          onChange={(e) => setClusterFitRatio(Number(e.target.value))}
        />
      </div>

      {query.isError && <ErrorBox error={query.error} fallback="Lỗi tải báo cáo" />}
      {query.isLoading && <p className="text-sm text-zinc-500">Đang tính...</p>}

      {data && (
        <p className="text-xs text-zinc-500">
          Đã kiểm tra {data.totalPoiChecked} điểm có toạ độ ({data.totalPoiSkippedNoCoords} điểm bỏ
          qua vì chưa có toạ độ).
        </p>
      )}

      {data && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Nghi trùng lặp ({data.duplicatePairs.length})</h2>
          {data.duplicatePairs.length === 0 ? (
            <p className="text-sm text-zinc-500">Không có cặp nào dưới ngưỡng đã chọn.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                  <tr>
                    <th className="p-2">Cụm</th>
                    <th className="p-2">Điểm A</th>
                    <th className="p-2">Điểm B</th>
                    <th className="p-2">Khoảng cách</th>
                    <th className="p-2">Độ giống tên</th>
                  </tr>
                </thead>
                <tbody>
                  {data.duplicatePairs.map((p, i) => (
                    <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="p-2 font-mono text-xs">{p.clusterSlug}</td>
                      <td className="p-2">
                        <Link href={`/dichoithoi/${p.slugA}`} className="underline">
                          {p.nameA}
                        </Link>
                      </td>
                      <td className="p-2">
                        <Link href={`/dichoithoi/${p.slugB}`} className="underline">
                          {p.nameB}
                        </Link>
                      </td>
                      <td className="p-2">{p.distanceMeters}m</td>
                      <td className="p-2">{Math.round(p.nameSimilarity * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {data && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Nghi sai cụm ({data.misclusteredPoints.length})</h2>
          {data.misclusteredPoints.length === 0 ? (
            <p className="text-sm text-zinc-500">Không có điểm nào khớp tiêu chí đã chọn.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
                  <tr>
                    <th className="p-2">Điểm</th>
                    <th className="p-2">Đang gán</th>
                    <th className="p-2">Đề xuất</th>
                  </tr>
                </thead>
                <tbody>
                  {data.misclusteredPoints.map((p) => (
                    <tr key={p.slug} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="p-2">
                        <Link href={`/dichoithoi/${p.slug}`} className="underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="p-2">
                        {p.currentParentSlug} ({p.currentDistanceMeters}m)
                      </td>
                      <td className="p-2">
                        {p.suggestedParentName} ({p.suggestedDistanceMeters}m)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
