/**
 * The one Google Fonts request every Cornerways page makes. Put these in the
 * page's <head>, before any stylesheet:
 *
 *   <link rel="preconnect" href="https://fonts.googleapis.com" />
 *   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
 *   <link href="{GOOGLE_FONTS_HREF}" rel="stylesheet" />
 */
export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap";

export const FONT_PRECONNECT_ORIGINS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] as const;
