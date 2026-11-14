import type { Metadata } from "next";
import { FaqPage } from "@/components/marketing/Pages";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Түгээмэл асуулт | ${BRAND.name}` };

export default function Page() {
  return <FaqPage />;
}
