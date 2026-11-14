import type { Metadata } from "next";
import { TermsPage } from "@/components/marketing/Legal";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Үйлчилгээний нөхцөл | Terms of Service — ${BRAND.name}` };

export default function Page() {
  return <TermsPage />;
}
