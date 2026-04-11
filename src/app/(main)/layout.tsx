"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { CommandPalette } from "@/components/CommandPalette";
import { useAuth } from "@/contexts/AuthContext";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userData } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (userData?.role?.toUpperCase() === "BOLSA") {
      if (!pathname.startsWith("/admin/bolsa-de-trabajo")) {
        router.replace("/admin/bolsa-de-trabajo");
      }
    }
  }, [userData, pathname, router]);

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-64">
        <Navbar />
        <main className="flex-1 p-3 sm:p-4 md:p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
