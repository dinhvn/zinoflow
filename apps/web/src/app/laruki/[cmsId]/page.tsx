"use client";

import { use } from "react";
import { CmsPostDetail } from "@/features/cms-content/cms-post-detail";

export default function LarukiDetailPage({ params }: { params: Promise<{ cmsId: string }> }) {
  const { cmsId } = use(params);
  return <CmsPostDetail site="laruki" cmsId={Number(cmsId)} />;
}
