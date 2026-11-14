import { Footer, Nav } from "@/components/marketing/Chrome";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing min-h-screen overflow-x-hidden">
      <Nav />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
