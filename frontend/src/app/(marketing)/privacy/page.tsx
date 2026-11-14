import type { Metadata } from "next";
import { PrivacyPage } from "@/components/marketing/Legal";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Нууцлалын бодлого | Privacy Policy — ${BRAND.name}` };

export default function Page() {
  return <PrivacyPage />;
}
