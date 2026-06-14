"use client";

import { use } from "react";
import { CmsPostDetail } from "@/features/cms-content/cms-post-detail";

export default function Dochoi3sDetailPage({ params }: { params: Promise<{ cmsId: string }> }) {
  const { cmsId } = use(params);
  return <CmsPostDetail site="dochoi3s" cmsId={Number(cmsId)} />;
}
