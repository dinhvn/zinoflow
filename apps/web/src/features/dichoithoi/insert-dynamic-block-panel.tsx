"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

type BlockKind =
  | "destinations"
  | "hotels"
  | "tours"
  | "destination"
  | "products"
  | "product"
  | "food-spots";

const BLOCK_LABELS: Record<BlockKind, string> = {
  destinations: "Danh sách điểm đến (theo loại/tỉnh)",
  hotels: "Danh sách khách sạn (theo tỉnh)",
  tours: "Danh sách tour (theo điểm đến/tỉnh)",
  destination: "1 điểm đến cụ thể (card đơn)",
  products: "Danh sách sản phẩm (theo tag)",
  product: "1 sản phẩm cụ thể (card đơn)",
  "food-spots": "Món ăn/quán ăn gần đây (theo tag)",
};

const SORT_OPTIONS = [
  { value: "featured", label: "Nổi bật trước" },
  { value: "newest", label: "Mới nhất trước" },
  { value: "order", label: "Theo thứ tự đã sắp" },
];

interface FormState {
  type: string;
  province: string;
  destination: string;
  slug: string;
  id: string;
  tag: string;
  category: string;
  limit: string;
  sort: string;
}

const EMPTY_FORM: FormState = {
  type: "",
  province: "",
  destination: "",
  slug: "",
  id: "",
  tag: "",
  category: "",
  limit: "8",
  sort: "featured",
};

/** Chuyển form tham số thành 1 dòng token `[[block:...]]` (article-spec §3). */
function buildToken(kind: BlockKind, form: FormState): string | null {
  if (kind === "destination") {
    if (!form.slug.trim()) return null;
    return `[[block:destination slug=${form.slug.trim()}]]`;
  }
  if (kind === "product") {
    if (!form.id.trim()) return null;
    return `[[block:product id=${form.id.trim()}]]`;
  }

  const params: string[] = [];
  if (kind === "destinations") {
    if (!form.type.trim() && !form.province.trim()) return null;
    if (form.type.trim()) params.push(`type=${form.type.trim()}`);
    if (form.province.trim()) params.push(`province=${form.province.trim()}`);
  } else if (kind === "hotels") {
    if (!form.province.trim()) return null;
    params.push(`province=${form.province.trim()}`);
  } else if (kind === "tours") {
    if (!form.destination.trim() && !form.province.trim()) return null;
    if (form.destination.trim()) params.push(`destination=${form.destination.trim()}`);
    if (form.province.trim()) params.push(`province=${form.province.trim()}`);
  } else if (kind === "products") {
    if (!form.tag.trim()) return null;
    params.push(`tag=${form.tag.trim()}`);
    if (form.category.trim()) params.push(`category=${form.category.trim()}`);
  } else if (kind === "food-spots") {
    if (!form.tag.trim()) return null;
    params.push(`tag=${form.tag.trim()}`);
  }

  const limit = Number(form.limit);
  if (Number.isFinite(limit) && limit > 0) params.push(`limit=${Math.min(limit, 12)}`);
  if (form.sort) params.push(`sort=${form.sort}`);

  return `[[block:${kind} ${params.join(" ")}]]`;
}

/**
 * Palette + form tham số "Chèn khối động" (article-spec §9) — 7 loại khối đã
 * build trong compiler thật (destinations/hotels/tours/destination/products/
 * product/food-spots, xem article-block-compiler.service.ts).
 */
export function InsertDynamicBlockPanel({ onInsert }: { onInsert: (token: string) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<BlockKind>("destinations");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const token = buildToken(kind, form);

  return (
    <div className="relative">
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
        {open ? "Đóng" : "+ Chèn khối động"}
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 space-y-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <Select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as BlockKind);
              setForm(EMPTY_FORM);
            }}
          >
            {(Object.keys(BLOCK_LABELS) as BlockKind[]).map((k) => (
              <option key={k} value={k}>
                {BLOCK_LABELS[k]}
              </option>
            ))}
          </Select>

          {kind === "destination" ? (
            <Input
              placeholder="Slug điểm đến (vd: thac-datanla)"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          ) : kind === "product" ? (
            <Input
              placeholder="ID sản phẩm"
              value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
            />
          ) : (
            <>
              {kind === "destinations" && (
                <Input
                  placeholder="Loại điểm đến (vd: thac-ho-suoi)"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                />
              )}
              {kind === "tours" && (
                <Input
                  placeholder="Slug điểm đến (vd: da-lat)"
                  value={form.destination}
                  onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                />
              )}
              {(kind === "products" || kind === "food-spots") && (
                <Input
                  placeholder="Tag (vd: da-lat — thường là slug điểm đến, cách nhau dấu phẩy)"
                  value={form.tag}
                  onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                />
              )}
              {kind === "products" && (
                <Input
                  placeholder="Category (tuỳ chọn, vd: Đồ lưu niệm)"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
              )}
              {(kind === "destinations" || kind === "hotels" || kind === "tours") && (
                <Input
                  placeholder="Mã/slug tỉnh (tuỳ chọn, vd: lam-dong)"
                  value={form.province}
                  onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                />
              )}
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  className="w-20"
                  value={form.limit}
                  onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value }))}
                />
                <Select
                  className="flex-1"
                  value={form.sort}
                  onChange={(e) => setForm((f) => ({ ...f, sort: e.target.value }))}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          )}

          {token && <p className="break-all rounded bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-800">{token}</p>}

          <Button
            type="button"
            size="sm"
            variant="primary"
            className="w-full"
            disabled={!token}
            onClick={() => {
              if (!token) return;
              onInsert(token);
              setOpen(false);
              setForm(EMPTY_FORM);
            }}
          >
            Chèn vào bài
          </Button>
        </div>
      )}
    </div>
  );
}
