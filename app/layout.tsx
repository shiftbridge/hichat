import "./globals.css";
import { ThemeController } from "@/components/theme-controller";

export const metadata = {
  title: "HiChat",
  description: "Real Time Chat",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeController />
        {children}
      </body>
    </html>
  );
}
