import type { Metadata } from "next";
import { Suspense } from "react";
import { DataDeletionPage, DeletionStatus } from "@/components/marketing/Legal";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Мэдээлэл устгах | Data Deletion — ${BRAND.name}` };

export default function Page() {
  // the status box reads ?code= (useSearchParams) → must sit inside Suspense
  return (
    <DataDeletionPage
      statusSlot={
        <Suspense>
          <DeletionStatus />
        </Suspense>
      }
    />
  );
}
