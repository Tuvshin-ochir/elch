import type { Metadata } from "next";
import { IndustriesPage } from "@/components/marketing/Pages";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Салбарууд — Таны бизнест тохирсон чатбот | ${BRAND.name}` };

export default function Page() {
  return <IndustriesPage />;
}
