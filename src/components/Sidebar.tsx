'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Image from 'next/image'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/firebase-client'
import {
  LayoutDashboard,
  FileText,
  User,
  Settings,
  Lock,
  LogOut,
  Menu,
  X,
  ChevronRight,
  BarChart3,
  FileBarChart,
  Users,
  ShieldCheck,
} from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import logoSNTSS from '@/assets/logo-sntss.png'
import seccion7 from '@/assets/seccion7.png'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase/firebase-client'
import { useToast } from './ui/use-toast'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const getNavItems = (rol?: string, pendingCount: number = 0): NavItem[] => {
  const baseItems: NavItem[] = []

  // Dashboard según rol
  const roleUpper = rol?.toUpperCase()

  if (roleUpper === 'ADMIN') {
    baseItems.push({
      title: 'Panel Admin',
      href: '/admin',
      icon: LayoutDashboard,
    })
  } else {
    baseItems.push({
      title: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    })
  }

  // Solo ADMIN puede ver propuestas
  if (roleUpper === 'ADMIN') {
    baseItems.push(
      {
        title: 'Propuestas',
        href: '/admin/propuestas',
        icon: FileText,
      },
      {
        title: 'Escalafón',
        href: '/admin/escalafon',
        icon: Users,
      },
      {
        title: 'Estadísticas',
        href: '/admin/estadisticas',
        icon: BarChart3,
      },
      {
        title: 'Reportes',
        href: '/admin/reportes',
        icon: FileBarChart,
      },
      {
        title: 'Validaciones',
        href: '/admin/validaciones',
        icon: ShieldCheck,
        badge: pendingCount > 0 ? pendingCount.toString() : undefined
      }
    )
  }

  // Items comunes para todos
  baseItems.push(
    {
      title: 'Mi Perfil',
      href: '/admin/perfil',
      icon: User,
    },
    {
      title: 'Configuración',
      href: '/admin/configuracion',
      icon: Settings,
    },
    {
      title: 'Cambiar Contraseña',
      href: '/admin/cambiar-contrasena',
      icon: Lock,
    }
  )

  return baseItems
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, userData } = useAuth()
  const { toast } = useToast()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (userData?.role?.toUpperCase() !== 'ADMIN') return

    const q = query(collection(db, 'users'), where('status', '==', 'pending'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.size)
    })

    return () => unsubscribe()
  }, [userData])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      toast({
        title: 'Sesión cerrada',
        description: 'Has cerrado sesión correctamente',
      })
      router.push('/login')
    } catch (error: any) {
      console.error('Error al cerrar sesión:', error)
      toast({
        title: 'Error',
        description: 'No se pudo cerrar sesión',
        variant: 'destructive',
      })
    }
  }

  const isActive = (href: string) => {
    if (href === '/dashboard' || href === '/admin') {
      return pathname === href
    }
    return pathname?.startsWith(href)
  }

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-3 left-3 sm:top-4 sm:left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-background/90 backdrop-blur-sm border shadow-md h-9 w-9 sm:h-10 sm:w-10"
        >
          {isOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
        </Button>
      </div>

      {/* Overlay para mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-64 sm:w-72 lg:w-64 bg-gradient-to-b from-red-950 via-red-900 to-red-800 text-white z-50 transform transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header con logos */}
          <div className="p-4 sm:p-6 border-b border-red-800/50">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <Image
                src={logoSNTSS}
                alt="SNTSS Logo"
                width={100}
                height={50}
                className="object-contain sm:w-[120px] sm:h-[60px]"
                priority
              />
            </div>
            <div className="flex items-center gap-2">
              <Image
                src={seccion7}
                alt="Sección VII"
                width={36}
                height={36}
                className="object-contain sm:w-10 sm:h-10"
              />
              <div>
                <p className="text-xs font-medium text-red-200">Sección VII</p>
                <p className="text-xs text-red-300">SNTSS</p>
              </div>
            </div>
          </div>

          {/* User info */}
          <div className="p-3 sm:p-4 border-b border-red-800/50 bg-red-900/30">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-red-700 flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0">
                {userData?.nombre?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium truncate">
                  {userData?.nombre} {userData?.apellidoPaterno}
                </p>
                <p className="text-[10px] sm:text-xs text-red-200 truncate">{user?.email}</p>
                {userData?.role && (
                  <span className="inline-block mt-1 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs bg-red-700/50 rounded text-red-100">
                    {userData.role.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1">
            {getNavItems(userData?.role, pendingCount).map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-all duration-200',
                    'hover:bg-red-800/50 hover:translate-x-1',
                    active
                      ? 'bg-red-800 text-white shadow-lg'
                      : 'text-red-100 hover:text-white'
                  )}
                >
                  <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0', active && 'text-white')} />
                  <span className="flex-1 font-medium text-sm sm:text-base">{item.title}</span>
                  {active && <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />}
                  {item.badge && (
                    <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs bg-white text-red-900 font-bold rounded-full min-w-[20px] text-center">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer con logout */}
          <div className="p-3 sm:p-4 border-t border-red-800/50">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-red-100 hover:text-white hover:bg-red-800/50 h-10 sm:h-11 text-sm sm:text-base"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}
