// src/app/(public)/layout.tsx
import { AtribucionZentry } from "@/components/AtribucionZentry";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="flex-1">{children}</div>
      <footer className="border-t border-slate-100 py-6 text-center">
        <AtribucionZentry />
      </footer>
    </div>
  );
}
