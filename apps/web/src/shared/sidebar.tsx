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
];

const DICHOITHOI_ITEMS: NavItem[] = [
  { href: "/dichoithoi", label: "Điểm đến", icon: IconMapPin, exclude: ["/dichoithoi/dia-chi"] },
  { href: "/dichoithoi/dia-chi", label: "Tra cứu địa chỉ", icon: IconSearch },
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

function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
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
