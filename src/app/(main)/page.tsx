'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Skeleton } from "@/components/ui/skeleton"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Redirigir a la página de login
    const redirectToLogin = () => {
      router.replace('/login')
    }
    redirectToLogin()
  }, [router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-8 w-3/4 mx-auto" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
        <Skeleton className="h-32 w-full" />
      </div>
    </main>
  )
}
