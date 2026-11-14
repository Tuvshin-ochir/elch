import type { Metadata } from "next";
import { PricingPage } from "@/components/marketing/Pages";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Үнэ — 99,000₮-с эхэлнэ | ${BRAND.name}` };

export default function Page() {
  return <PricingPage />;
}
