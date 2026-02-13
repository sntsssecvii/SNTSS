'use client'

import { Sidebar } from '@/components/Sidebar'
import { Navbar } from '@/components/Navbar'
import { CommandPalette } from '@/components/CommandPalette'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-64">
        <Navbar />
        <main className="flex-1 p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
