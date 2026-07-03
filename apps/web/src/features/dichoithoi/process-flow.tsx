import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/shared/ui/badge";

/**
 * So do truc quan luong hoat dong A->Z cua module dichoithoi (tai lieu noi bo).
 * Component tinh (khong state) — dung Badge shared cho cac chip "cham DB nao".
 * Noi dung dung code hien tai; cap nhat cung luc khi doi pipeline destination.
 */

type Store = { title: string; desc: string; tone: BadgeTone };

const STORES: Store[] = [
  {
    title: "SQL Server (website thật)",
    desc: "Schema v2 do repo dichoithoi sở hữu. Tool chỉ UPSERT, không bao giờ wipe.",
    tone: "emerald",
  },
  {
    title: "Postgres — mirror",
    desc: 'Bản sao trong tool + giữ quan hệ "mentioned" và trạng thái job AI.',
    tone: "indigo",
  },
  {
    title: "Cổng thủ công ▲",
    desc: "Người vận hành chặn: Duyệt bài (gates) và Publish (gate ảnh).",
    tone: "amber",
  },
];

type Chip = { label: string; tone: BadgeTone };

type Stage = {
  num: string;
  title: string;
  trigger?: string;
  desc: ReactNode;
  branches?: ReactNode[];
  chips: Chip[];
  /** Cong thu cong -> vien amber + badge */
  gate?: string;
};

const STAGES: Stage[] = [
  {
    num: "0",
    title: "Nền dữ liệu hành chính",
    trigger: "1 lần · pnpm seed:dvhcvn",
    desc: (
      <>
        Seed 34 tỉnh / 3.321 phường xã / 10.039 mapping từ dvhcvn. Phục vụ tra cứu địa chỉ cũ→mới
        sau sáp nhập và gán <Code>provinceCode</Code>.
      </>
    ),
    chips: [{ label: "ghi Postgres", tone: "indigo" }],
  },
  {
    num: "1",
    title: "Đồng bộ mirror",
    trigger: "POST /destinations/sync",
    desc: (
      <>
        Đọc 1 chiều từ SQL Server, upsert theo <Code>slug</Code> vào mirror. Domain{" "}
        <Code>decideSyncAction</Code> quyết định per-row và đánh cờ — <b>không tự xóa</b>.
      </>
    ),
    branches: [
      <><b>insert</b> — điểm chưa có trong mirror</>,
      <><b>edited-outside</b> — hash đổi mà tool chưa publish (sửa tay trên DB)</>,
      <><b>skip-conflict</b> — mirror có sửa local chưa publish</>,
      <><b>orphan</b> — biến mất bên site → gắn cờ, giữ nguyên</>,
    ],
    chips: [
      { label: "đọc SQL Server", tone: "emerald" },
      { label: "ghi mirror", tone: "indigo" },
    ],
  },
  {
    num: "2",
    title: "Tạo / nhập điểm đến vào tool",
    trigger: "siteId = null",
    desc: <>Ba đường vào, đều tạo mirror row &quot;sống trong tool&quot; cho tới khi publish:</>,
    branches: [
      <><b>Tạo lẻ</b> — /dichoithoi/new → POST /destinations (chặn trùng slug, kiểm cha/tỉnh)</>,
      <><b>Import hàng loạt</b> — từ Google Sheet công khai, UPSERT theo slug</>,
      <><b>Gợi ý metadata bằng AI</b> — chỉ mô tả/phân loại, không đụng toạ độ</>,
    ],
    chips: [
      { label: "ghi mirror", tone: "indigo" },
      { label: "AI (tuỳ chọn)", tone: "blue" },
    ],
  },
  {
    num: "3",
    title: "Viết bài bằng AI",
    trigger: "POST /destinations/:slug/jobs",
    desc: (
      <>
        Dựng <b>sourceContext</b> (nguồn sự thật) rồi ủy thác pipeline chung <Code>ai-content</Code>{" "}
        với <Code>articleType = guide-diem-den</Code>. Module này không gọi AI trực tiếp.
      </>
    ),
    branches: [
      <>Ghép: facts mirror + <b>điểm liên quan cùng tỉnh</b> (để AI nhắc đúng tên → auto-link)</>,
      <>+ nội dung web hiện tại (mode <b>update</b>) + ghi chú admin + text tối đa 5 URL nguồn</>,
      <>Generate chạy trên worker pg-boss; version draft tăng mỗi lần gen lại</>,
    ],
    chips: [
      { label: "gọi AI provider", tone: "blue" },
      { label: "setActiveJob", tone: "indigo" },
    ],
  },
  {
    num: "4",
    title: "Review",
    gate: "Cổng thủ công #1 — Duyệt",
    desc: (
      <>
        Dùng chung workflow ai-content: submit → InReview → Approve / Reject / RequestChange.{" "}
        <b>Approve chạy lại gates ngay lúc duyệt</b>; bài điểm đến chọn <b>4 gate travel</b>{" "}
        (updateNotice tháng/năm, giá kèm lưu ý, cấm claim tuyệt đối, slug không trùng).
      </>
    ),
    branches: [
      <><b>Fail</b> → 422 kèm chi tiết từng gate</>,
      <>Sửa bài đã Approved → tự về InReview + tạo version mới</>,
    ],
    chips: [
      { label: "chặn nếu gate fail", tone: "amber" },
      { label: "ReviewRecord", tone: "indigo" },
    ],
  },
  {
    num: "5",
    title: "Publish",
    gate: "Cổng thủ công #2 — Đăng",
    desc: (
      <>
        Nút &quot;Đăng lên dichoithoi&quot; chỉ hiện khi <b>Approved</b>. Điều kiện: job Approved +{" "}
        <b>có thumbnail</b> (gate ảnh).
      </>
    ),
    branches: [
      <><b>1.</b> Điểm mới (siteId=null) → INSERT shell xuống SQL Server lấy siteId</>,
      <><b>2.</b> Render thân bài → HTML sạch → <b>auto-link</b> tới điểm published khác (idempotent)</>,
      <><b>3.</b> 1 transaction <b>UPSERT không wipe</b>: Destination + DestinationContent + mentioned, ContentSource=1</>,
      <><b>4.</b> Ghi mentioned vào Postgres · markPublished (hash từ SQL)</>,
      <><b>5.</b> Recompute RelatedJson <b>hẹp</b> — chỉ điểm bị ảnh hưởng (con→curated→nearby 30km→anh em→cùng tỉnh, cắt 8)</>,
    ],
    chips: [
      { label: "gate ảnh", tone: "amber" },
      { label: "UPSERT SQL Server", tone: "emerald" },
      { label: "markPublished", tone: "indigo" },
    ],
  },
];

type Op = { title: string; endpoint: string; desc: string };

const OPS: Op[] = [
  {
    title: "Re-link toàn bộ",
    endpoint: "POST /destinations/relink",
    desc: "Dry-run xem trước → confirm ghi, chuẩn hoá SlugRedirect.",
  },
  {
    title: "Tính lại RelatedJson",
    endpoint: "POST /destinations/recompute-related",
    desc: "Quét toàn bộ điểm published.",
  },
  {
    title: "Kiểm tra ảnh",
    endpoint: "POST /destinations/check-image",
    desc: "HEAD request tới hosting.",
  },
];

const RISKS: ReactNode[] = [
  <>
    <b>DICHOITHOI_IMAGE_BASE_URL đang là phỏng đoán</b> (contents/diem-den/) — gate ảnh có thể
    pass/fail sai nếu cấu trúc hosting thật khác.
  </>,
  <>
    <b>.env đang trỏ sandbox LocalDB</b>, không phải production. Go-live phải đổi DICHOITHOI_DB_*,
    backup, chạy lại 2 script schema.
  </>,
  <>
    <b>RelatedJson &quot;cùng loại chính&quot; tạm thay bằng &quot;cùng tỉnh&quot;</b> — mirror chưa
    có type map, related có thể chưa đúng ý đồ.
  </>,
  <>
    <b>publish-destination và create-destination-job usecase = 0% test</b> — orchestration quan
    trọng nhất chưa có lưới an toàn.
  </>,
  <>
    <b>Gate M4 chưa verify E2E</b> — chưa có bài thật đi trọn create→review→publish; job &quot;Núi
    Hàm Rồng&quot; còn ở DraftReady.
  </>,
];

/** Doan code inline dong nhat (mono + mau accent). */
function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[12px] text-teal-700 dark:bg-zinc-800 dark:text-teal-300">
      {children}
    </code>
  );
}

export function DestinationProcessFlow() {
  return (
    <div className="max-w-4xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-600 dark:text-teal-400">
          ZinoFlow · Module dichoithoi
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Luồng hoạt động: từ điểm đến trống đến bài publish
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          AI viết bài điểm đến du lịch rồi publish thẳng vào SQL Server của dichoithoi.com — không
          qua CMS cũ. Toàn bộ chuỗi neo trên <b>hai nguồn dữ liệu</b> và đi qua <b>hai cổng thủ
          công</b> (Duyệt ≠ Publish).
        </p>
      </header>

      {/* Legend nguon du lieu */}
      <div className="grid gap-3 sm:grid-cols-3">
        {STORES.map((s) => (
          <div
            key={s.title}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-1.5">
              <Badge tone={s.tone}>{s.title}</Badge>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Rail cac giai doan */}
      <ol className="space-y-0">
        {STAGES.map((stage, idx) => (
          <li key={stage.num} className="relative pl-16 pb-6 last:pb-0">
            {/* connector line */}
            {idx < STAGES.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[27px] top-2 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-700"
              />
            )}
            {/* so thu tu */}
            <span
              className={`absolute left-0 top-0 grid h-11 w-11 place-items-center rounded-xl text-base font-bold text-white ${
                stage.gate ? "bg-amber-600" : "bg-zinc-900 dark:bg-zinc-700"
              }`}
            >
              {stage.num}
            </span>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-100">
                  {stage.title}
                </h2>
                {stage.gate ? (
                  <Badge tone="amber">▲ {stage.gate}</Badge>
                ) : (
                  stage.trigger && (
                    <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                      {stage.trigger}
                    </span>
                  )
                )}
              </div>

              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{stage.desc}</p>

              {stage.branches && (
                <div className="mt-3 space-y-1.5 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                  {stage.branches.map((b, i) => (
                    <div key={i} className="text-[13px] text-zinc-600 dark:text-zinc-400">
                      {b}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {stage.chips.map((c) => (
                  <Badge key={c.label} tone={c.tone}>
                    {c.label}
                  </Badge>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Van hanh phu */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
          Vận hành phụ — trang Công cụ /dichoithoi
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Chạy độc lập với pipeline một-điểm ở trên, tác động toàn bộ điểm đã published.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {OPS.map((op) => (
            <div key={op.title} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <h4 className="text-[13.5px] font-semibold text-zinc-900 dark:text-zinc-100">
                {op.title}
              </h4>
              <p className="mt-1 font-mono text-[11.5px] text-teal-700 dark:text-teal-300">
                {op.endpoint}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{op.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rui ro */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-orange-600 dark:text-orange-400">
          Điểm cần lưu ý trước khi chạy thật
        </h3>
        <div className="space-y-2.5">
          {RISKS.map((r, i) => (
            <div
              key={i}
              className="flex gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-950 dark:bg-orange-950/30"
            >
              <span className="font-bold text-orange-600 dark:text-orange-400">!</span>
              <p className="text-[13.5px] text-orange-900 dark:text-orange-200">{r}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-200 pt-4 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        Sơ đồ dựng từ code hiện tại · module apps/api/src/modules/destination
      </footer>
    </div>
  );
}
