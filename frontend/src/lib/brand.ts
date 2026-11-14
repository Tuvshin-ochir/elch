/** Change the product name / contact info here. Contact details can be overridden per deployment via env. */
export const BRAND = {
  /** Mongolian (default) name — used in page titles, logo, footer */
  name: "Элч",
  /** Latin spelling — used on the English UI and in URLs / file names */
  nameEn: "Elch",
  tagline: { mn: "Таны бизнесийн элч", en: "Your business's messenger" },
  domain: "elch.chat",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@elch.chat",
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "7700-0000",
  year: 2026,
};
