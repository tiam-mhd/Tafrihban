import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "تفریح‌بان | بازرسی و نگهداری تجهیزات",
    short_name: "تفریح‌بان",
    description: "ثبت بازرسی و پیگیری تعمیرات تجهیزات تفریحی",
    start_url: "/app/select-scope",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6f4",
    theme_color: "#145f58",
    lang: "fa",
    dir: "rtl",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
