"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Box, Typography } from "@mui/material";
import Image from "next/image";
import LeftIcon from "@/modules/shared/assets/images/chevronBack.png";
import { ButtonIcon } from "@/modules/shared/component/ButtonIcon";
import guidesCategories from "@/data/guidesData.json";
import CategoryGuideContent from "../CategoryGuideContent";

interface GuideTopic {
  icon: string;
  label: string;
  slug: string;
}

interface GuideCategory {
  id: string;
  icon: string;
  title: string;
  description: string;
  topics: GuideTopic[];
}

// Categories visible to parents. Detail pages for other categories return a
// "not found" view when accessed from /parent/guides so parents only ever see
// guides that apply to them.
const PARENT_GUIDE_CATEGORY_IDS = new Set(["parent-dashboard"]);

function findCategoryById(categoryId: string) {
  return (guidesCategories as GuideCategory[]).find((cat) => cat.id === categoryId) || null;
}

export default function CategoryDetailPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const isParentContext = pathname.startsWith("/parent");
  const guideRoot = pathname.startsWith("/staff")
    ? "/staff/guides"
    : isParentContext
      ? "/parent/guides"
      : pathname.startsWith("/admin")
        ? "/admin/guides"
        : "/guides";
  const rawCategory = findCategoryById(resolvedParams.categoryId);
  const category =
    rawCategory && (!isParentContext || PARENT_GUIDE_CATEGORY_IDS.has(rawCategory.id))
      ? rawCategory
      : null;

  if (!category) {
    return (
      <Box className="p-5 flex flex-col items-center justify-center gap-4 min-h-[400px]">
        <Typography className="!text-xl !font-semibold !text-[#344054]">Category not found</Typography>
        <Link
          href={guideRoot}
          className="text-[#00897B] text-sm font-medium hover:underline no-underline"
        >
          ← Back to Guides
        </Link>
      </Box>
    );
  }

  return (
    <Box className="p-5 flex flex-col gap-6">
      {/* Header */}
      <nav className="flex items-center gap-4 text-sm">
        <ButtonIcon
          className="rounded-full !border !border-brandColor-active/20 !p- flex items-center justify-center"
          onClick={() => router.push(guideRoot)}
        >
          <Image src={LeftIcon || "/placeholder.svg"} alt="back" />
        </ButtonIcon>
        <Box>
          <span className="text-[#344054] text-xl font-semibold truncate max-w-[280px]">
            {category.title}
          </span>
          <Typography className="!text-sm !text-[#475467] !leading-relaxed">
            {category.description}
          </Typography>
        </Box>
      </nav>

      {/* Content */}
      <div className="bg-white rounded-xl border border-[#E4E7EC] px-6 py-8">
        <CategoryGuideContent category={category} />
      </div>
    </Box>
  );
}
