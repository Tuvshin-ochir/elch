import { DashboardShell } from "@/components/dashboard/Shell";

// The dashboard is client-rendered behind the auth check (token in localStorage),
// so its segments can't be validated for instant navigation.
export const instant = false;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
