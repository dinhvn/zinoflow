"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod/v4";
import { itineraryPlanSchema, type ItineraryPlan } from "@zinoflow/contracts";
import { apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

function emptyItem(): ItemForm {
  return { period: "", poiSlug: "", note: "" };
}
function emptyDay(): DayForm {
  return { dayLabel: "", items: [emptyItem()] };
}
function emptyPlan(): PlanForm {
  return { label: "", days: [emptyDay()] };
}

type PlanForm = { label: string; days: DayForm[] };
type DayForm = { dayLabel: string; items: ItemForm[] };
type ItemForm = { period: string; poiSlug: string; note: string };

function toForm(plans: readonly ItineraryPlan[]): PlanForm[] {
  return plans.map((p) => ({
    label: p.label,
    days: p.days.map((d) => ({
      dayLabel: d.dayLabel,
      items: d.items.map((i) => ({ period: i.period, poiSlug: i.poiSlug ?? "", note: i.note })),
    })),
  }));
}

/**
 * Sua "Lịch trình gợi ý" (2N1D/3N2D...) — nhap tay hoan toan, chi hien thi y
 * nghia voi diem Flagship (content-seo-ux-plan §10.6.2 khoi 3, Phase 28.0).
 * Cau truc: nhieu mau lich trinh -> nhieu ngay -> nhieu muc (buoi/POI/ghi chu).
 */
export function DestinationItineraryEditor({
  slug,
  itinerary,
  onSaved,
}: {
  slug: string;
  itinerary: ItineraryPlan[];
  onSaved: () => void;
}) {
  const [plans, setPlans] = useState<PlanForm[]>(toForm(itinerary));
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        itinerary: plans
          .filter((p) => p.label.trim())
          .map((p) => ({
            label: p.label.trim(),
            days: p.days
              .filter((d) => d.dayLabel.trim())
              .map((d) => ({
                dayLabel: d.dayLabel.trim(),
                items: d.items
                  .filter((it) => it.note.trim())
                  .map((it) => ({
                    period: it.period.trim() || "Cả ngày",
                    poiSlug: it.poiSlug.trim() || null,
                    note: it.note.trim(),
                  })),
              }))
              .filter((d) => d.items.length > 0),
          }))
          .filter((p) => p.days.length > 0),
      };
      return z
        .array(itineraryPlanSchema)
        .parse(await apiSend("POST", `/destinations/${slug}/itinerary`, body));
    },
    onSuccess: (saved) => {
      setError(null);
      setPlans(toForm(saved));
      onSaved();
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { message: e.message, details: e.details }
          : { message: String(e), details: [] },
      ),
  });

  const updatePlan = (pi: number, patch: Partial<PlanForm>) =>
    setPlans((prev) => prev.map((p, i) => (i === pi ? { ...p, ...patch } : p)));

  const updateDay = (pi: number, di: number, patch: Partial<DayForm>) =>
    setPlans((prev) =>
      prev.map((p, i) =>
        i === pi ? { ...p, days: p.days.map((d, j) => (j === di ? { ...d, ...patch } : d)) } : p,
      ),
    );

  const updateItem = (pi: number, di: number, ii: number, patch: Partial<ItemForm>) =>
    setPlans((prev) =>
      prev.map((p, i) =>
        i === pi
          ? {
              ...p,
              days: p.days.map((d, j) =>
                j === di
                  ? { ...d, items: d.items.map((it, k) => (k === ii ? { ...it, ...patch } : it)) }
                  : d,
              ),
            }
          : p,
      ),
    );

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Chỉ hiển thị trên trang các điểm Chủ lực (Flagship) — nhập tay hoàn toàn, mỗi mẫu lịch
        trình (vd &quot;2N1D&quot;) gồm nhiều ngày, mỗi ngày gồm nhiều mục (buổi/điểm/ghi chú).
      </p>
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">{error.message}</p>
        </div>
      )}

      <div className="space-y-4">
        {plans.map((plan, pi) => (
          <div key={pi} className="rounded-lg border-2 border-zinc-300 p-3 dark:border-zinc-700">
            <div className="mb-2 flex items-center gap-2">
              <Input
                value={plan.label}
                onChange={(e) => updatePlan(pi, { label: e.target.value })}
                placeholder="Tên mẫu (vd: 2N1D)"
                className="max-w-40"
              />
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto px-2 py-1 text-xs"
                onClick={() => setPlans((prev) => prev.filter((_, i) => i !== pi))}
              >
                Xoá mẫu
              </Button>
            </div>

            <div className="space-y-2 pl-3">
              {plan.days.map((day, di) => (
                <div key={di} className="rounded border border-zinc-200 p-2 dark:border-zinc-800">
                  <div className="mb-1 flex items-center gap-2">
                    <Input
                      value={day.dayLabel}
                      onChange={(e) => updateDay(pi, di, { dayLabel: e.target.value })}
                      placeholder="Ngày (vd: Ngày 1)"
                      className="max-w-32 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto px-2 py-1 text-xs"
                      onClick={() =>
                        updatePlan(pi, { days: plan.days.filter((_, j) => j !== di) })
                      }
                    >
                      Xoá ngày
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {day.items.map((item, ii) => (
                      <div key={ii} className="grid grid-cols-1 gap-1 md:grid-cols-[100px_140px_1fr_auto]">
                        <Input
                          value={item.period}
                          onChange={(e) => updateItem(pi, di, ii, { period: e.target.value })}
                          placeholder="Sáng/Chiều/Tối"
                          className="text-xs"
                        />
                        <Input
                          value={item.poiSlug}
                          onChange={(e) => updateItem(pi, di, ii, { poiSlug: e.target.value })}
                          placeholder="Slug POI (tuỳ chọn)"
                          className="text-xs"
                        />
                        <Input
                          value={item.note}
                          onChange={(e) => updateItem(pi, di, ii, { note: e.target.value })}
                          placeholder="Nội dung"
                          className="text-xs"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          onClick={() =>
                            updateDay(pi, di, { items: day.items.filter((_, k) => k !== ii) })
                          }
                        >
                          Xoá
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="mt-1 px-2 py-1 text-xs"
                    onClick={() => updateDay(pi, di, { items: [...day.items, emptyItem()] })}
                  >
                    + Mục
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                className="px-2 py-1 text-xs"
                onClick={() => updatePlan(pi, { days: [...plan.days, emptyDay()] })}
              >
                + Ngày
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="px-2 py-1 text-xs"
          onClick={() => setPlans((prev) => [...prev, emptyPlan()])}
        >
          + Thêm mẫu lịch trình
        </Button>
        <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Đang lưu..." : "Lưu lịch trình"}
        </Button>
      </div>
    </div>
  );
}
