"use client";

import type { SVGProps } from "react";
import { usePathname } from "next/navigation";
import { ZinoFlowLogo } from "@/shared/zinoflow-logo";

/**
 * Sidebar dieu huong chinh. Client component vi can usePathname de to dam
 * muc dang mo (active state). Cau truc menu theo spec dichoithoi §7.1.
 */

type NavItem = {
  href: string;
  label: string;
  icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
  /** Khop chinh xac (chi Dashboard "/") — cac muc khac khop ca route con */
  exact?: boolean;
  /** Tien to bi loai khoi active (vd Diem den khong active khi dang o /dichoithoi/dia-chi) */
  exclude?: string[];
};

const MAIN_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: IconDashboard, exact: true },
  { href: "/content", label: "AI Content", icon: IconSparkles },
  { href: "/prompts", label: "Prompt mẫu", icon: IconDoc },
  { href: "/image-studio", label: "Tạo ảnh sản phẩm", icon: IconImage },
  { href: "/usage", label: "Chi phí AI", icon: IconChart },
];

const DICHOITHOI_ITEMS: NavItem[] = [
  {
    href: "/dichoithoi",
    label: "Điểm đến",
    icon: IconMapPin,
    exclude: [
      "/dichoithoi/articles",
      "/dichoithoi/dia-chi",
      "/dichoithoi/quy-trinh",
      "/dichoithoi/danh-muc",
      "/dichoithoi/chu-de",
      "/dichoithoi/phan-loai",
      "/dichoithoi/do-phu",
      "/dichoithoi/ban-do",
      "/dichoithoi/thu-vien-anh",
    ],
  },
  { href: "/dichoithoi/ban-do", label: "Bản đồ tổng quan", icon: IconMap },
  { href: "/dichoithoi/articles", label: "Article", icon: IconDoc },
  { href: "/dichoithoi/thu-vien-anh", label: "Thư viện ảnh", icon: IconImage },
  { href: "/dichoithoi/danh-muc", label: "Nội dung danh mục", icon: IconDoc },
  { href: "/dichoithoi/chu-de", label: "Chủ đề", icon: IconTag },
  { href: "/dichoithoi/phan-loai", label: "Rà soát loại hình", icon: IconFlow },
  { href: "/dichoithoi/do-phu", label: "Độ phủ nội dung", icon: IconChart },
  { href: "/dichoithoi/khach-san", label: "Khách sạn", icon: IconHotel },
  { href: "/dichoithoi/tour", label: "Tour", icon: IconCompass },
  { href: "/dichoithoi/ve", label: "Vé", icon: IconTicket },
  { href: "/dichoithoi/san-pham", label: "Sản phẩm", icon: IconTag },
  { href: "/dichoithoi/quy-trinh", label: "Quy trình", icon: IconFlow },
];

/** Công cụ (destination-spec §7.1) — tiện ích tra cứu/cấu hình nền, không phải trang soạn nội dung */
const DICHOITHOI_TOOL_ITEMS: NavItem[] = [
  { href: "/dichoithoi/dia-chi", label: "Tra cứu địa chỉ", icon: IconSearch },
  { href: "/dichoithoi/affiliate", label: "Quy tắc affiliate", icon: IconLink },
  { href: "/dichoithoi/backup-con-lai", label: "Backup còn lại", icon: IconDoc },
];

/** Khu CMS khuyenmai (laruki + dochoi3s) — tao content AI ghi vao CMS */
const KHUYENMAI_ITEMS: NavItem[] = [
  { href: "/laruki", label: "Laruki", icon: IconTag },
  { href: "/dochoi3s", label: "Dochoi3s", icon: IconTag },
];

const BOTTOM_ITEMS: NavItem[] = [{ href: "/settings", label: "Settings", icon: IconSettings }];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  if (item.exclude?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(item, pathname);
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
        active
          ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
      }`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 ${
          active ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400 group-hover:text-zinc-500 dark:group-hover:text-zinc-300"
        }`}
      />
      <span>{item.label}</span>
    </a>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/50 px-3 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="mb-6 px-2">
        <ZinoFlowLogo />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {MAIN_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* Khu Dichoithoi (spec dichoithoi-destination-spec §7.1) —
            Taxonomy / Review khach / Cong cu se hien khi sang giai doan 2 */}
        <div className="mt-5 mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Dichoithoi
        </div>
        {DICHOITHOI_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        <div className="mt-3 mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Công cụ
        </div>
        {DICHOITHOI_TOOL_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* Khu CMS khuyenmai (spec laruki-dochoi3s-content-spec §3.1) */}
        <div className="mt-5 mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Affiliate (CMS)
        </div>
        {KHUYENMAI_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* Settings tach khoi cac nhom tren bang duong ke (KHONG ghim day sidebar:
            tranh nut dev-tools "N" cua Next o goc duoi-trai de len) */}
        <div className="mt-4 border-t border-zinc-200 pt-2 dark:border-zinc-800">
          {BOTTOM_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>
    </aside>
  );
}

/* --- Icon set (inline, stroke 1.75 — dong bo kich thuoc 18px) --- */

function IconBase({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

function IconDashboard(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </IconBase>
  );
}

function IconSparkles(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M18 15l.7 1.8L20.5 17.5 18.7 18.2 18 20l-.7-1.8L15.5 17.5l1.8-.7z" />
    </IconBase>
  );
}

function IconMapPin(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 1116 0z" />
      <circle cx="12" cy="10" r="2.75" />
    </IconBase>
  );
}

function IconMap(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </IconBase>
  );
}

function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </IconBase>
  );
}

function IconTag(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.2" />
    </IconBase>
  );
}

function IconImage(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </IconBase>
  );
}

function IconChart(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 15l3-4 3 2 4-6" />
    </IconBase>
  );
}

function IconDoc(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </IconBase>
  );
}

function IconFlow(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="4" y="3" width="7" height="5" rx="1.5" />
      <rect x="13" y="16" width="7" height="5" rx="1.5" />
      <path d="M7.5 8v4a2 2 0 002 2h7" />
    </IconBase>
  );
}

function IconHotel(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 21V6a1 1 0 011-1h6a1 1 0 011 1v15" />
      <path d="M13 21v-9a1 1 0 011-1h6a1 1 0 011 1v9" />
      <path d="M3 21h18" />
      <path d="M7 8h2M7 12h2M7 16h2" />
    </IconBase>
  );
}

function IconCompass(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 9.2l-1.6 4.4-4.4 1.6 1.6-4.4z" />
    </IconBase>
  );
}

function IconTicket(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 9a2 2 0 100 6v2a2 2 0 002 2h14a2 2 0 002-2v-2a2 2 0 100-6V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
      <path d="M13 4v3M13 17v3M13 10v4" />
    </IconBase>
  );
}

function IconLink(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M9 15l6-6" />
      <path d="M11 6l.8-.8a3.5 3.5 0 015 5l-.8.8" />
      <path d="M13 18l-.8.8a3.5 3.5 0 01-5-5l.8-.8" />
    </IconBase>
  );
}

function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </IconBase>
  );
}
