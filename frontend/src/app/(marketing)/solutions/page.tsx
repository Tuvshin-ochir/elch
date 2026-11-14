import type { Metadata } from "next";
import { SolutionsPage } from "@/components/marketing/Pages";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Шийдэл — Чатаар ирж буй боломжоо алдахаа больё | ${BRAND.name}` };

export default function Page() {
  return <SolutionsPage />;
}
