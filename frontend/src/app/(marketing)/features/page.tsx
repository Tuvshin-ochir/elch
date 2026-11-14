import type { Metadata } from "next";
import { FeaturesPage } from "@/components/marketing/Pages";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Боломжууд — AI чатбот, суваг, автоматжуулалт, аналитик | ${BRAND.name}` };

export default function Page() {
  return <FeaturesPage />;
}
