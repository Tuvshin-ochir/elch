import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Spinner } from "@/components/ui";

// Client-rendered behind the admin auth check (token in localStorage).
export const instant = false;

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  // usePathname()/useParams() suspend on request-time routes like /admin/businesses/[id]
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-canvas text-brand-600">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
