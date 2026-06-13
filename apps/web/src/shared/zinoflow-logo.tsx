import type { SVGProps } from "react";

/**
 * Logo nhan dien thuong hieu ZinoFlow.
 *
 * - `ZinoFlowMark`: chi rieng bieu tuong (squircle gradient + chu Z dang "flow" + tia AI).
 *   Dung cho favicon, avatar, cho hep.
 * - `ZinoFlowLogo`: lockup ngang gom mark + chu "ZinoFlow". Dung o header/sidebar.
 *
 * Mau lay tu bang AI hien dai: tim (#8B5CF6) -> cham (#6366F1) -> cyan (#06B6D4).
 */
export function ZinoFlowMark({ title = "ZinoFlow", ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title} {...props}>
      <defs>
        <linearGradient id="zfm-bg" x1="32" y1="32" x2="480" y2="480" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="0.5" stopColor="#6366F1" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
        <linearGradient id="zfm-flow" x1="150" y1="170" x2="362" y2="342" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#E0F2FE" />
        </linearGradient>
        <radialGradient id="zfm-glow" cx="0.32" cy="0.28" r="0.9">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="32" y="32" width="448" height="448" rx="116" fill="url(#zfm-bg)" />
      <rect x="32" y="32" width="448" height="448" rx="116" fill="url(#zfm-glow)" />
      <rect x="150" y="150" width="212" height="46" rx="23" fill="#ffffff" />
      <rect x="150" y="316" width="212" height="46" rx="23" fill="#ffffff" />
      <path
        d="M338 176 C300 232 250 250 222 290 C200 322 184 336 174 336"
        stroke="url(#zfm-flow)"
        strokeWidth="46"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="338" cy="176" r="15" fill="#ffffff" />
      <circle cx="174" cy="336" r="15" fill="#ffffff" />
      <path
        d="M372 96 C374 116 384 126 404 128 C384 130 374 140 372 160 C370 140 360 130 340 128 C360 126 370 116 372 96Z"
        fill="#ffffff"
      />
      <path
        d="M410 150 C411 160 416 165 426 166 C416 167 411 172 410 182 C409 172 404 167 394 166 C404 165 409 160 410 150Z"
        fill="#ffffff"
        opacity="0.9"
      />
    </svg>
  );
}

export function ZinoFlowLogo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <ZinoFlowMark className="h-8 w-8 shrink-0 rounded-[9px] shadow-sm" />
      <span className="text-lg font-bold tracking-tight">
        Zino
        <span className="bg-gradient-to-r from-indigo-500 to-cyan-500 bg-clip-text text-transparent">Flow</span>
      </span>
    </span>
  );
}
