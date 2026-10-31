import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

export const metadata: Metadata = {
  title: { default: "تفریح‌بان | بازرسی و نگهداری تجهیزات", template: "%s | تفریح‌بان" },
  description: "پروندهٔ تجهیزات، بازرسی‌های برنامه‌ریزی‌شده و پیگیری اقدامات اصلاحی.",
  applicationName: "تفریح‌بان",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/Light-Logo.png", type: "image/png", sizes: "1254x1254" }],
    apple: [{ url: "/Light-Logo.png", type: "image/png", sizes: "1254x1254" }],
  },
  appleWebApp: { capable: true, title: "تفریح‌بان", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#145f58",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body><ServiceWorkerRegister />{children}</body></html>;
}
