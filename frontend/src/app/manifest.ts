import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${BRAND.tagline.mn}`,
    short_name: BRAND.name,
    description: "Facebook, Instagram болон вэбсайтад 24/7 хариулдаг AI туслах.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#faf6ee",
    theme_color: "#12805a",
    lang: "mn",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
