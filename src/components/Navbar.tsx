'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import Link from 'next/link'
import { Bell, Search, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { auth } from '@/lib/firebase/firebase-client'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { useToast } from './ui/use-toast'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './ThemeToggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

export function Navbar() {
  const { user, userData } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()

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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'info':
      case 'registration':
      case 'system':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const formatTime = (createdAt: any) => {
    if (!createdAt) return 'Reciente'
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `${minutes}m`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`

    return date.toLocaleDateString()
  }

  return (
    <nav className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-2 sm:px-4 lg:pl-4">
        {/* Left side - Search */}
        <div className="flex flex-1 items-center gap-2 sm:gap-4 ml-12 lg:ml-0">
          <div className="relative w-full max-w-xs sm:max-w-sm">
            <Search className="absolute left-2 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar..."
              className="pl-7 sm:pl-9 h-9 sm:h-10 text-sm"
            />
          </div>
        </div>

        {/* Right side - User menu */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-red-600 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0">
              <div className="flex items-center justify-between p-4 border-b">
                <DropdownMenuLabel className="p-0 font-semibold">
                  Notificaciones
                </DropdownMenuLabel>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Marcar todas como leídas
                  </Button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay notificaciones</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4 border-b hover:bg-muted/50 transition-colors cursor-pointer",
                        !notification.read && "bg-blue-50/50 dark:bg-blue-950/20"
                      )}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn(
                              "text-sm font-medium",
                              !notification.read && "font-semibold"
                            )}>
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <span className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {notifications.length > 0 && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                  >
                    Ver todas las notificaciones
                  </Button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2 sm:px-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-xs sm:text-sm">
                  {userData?.nombre?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs sm:text-sm font-medium truncate max-w-[120px]">
                    {userData?.nombre} {userData?.apellidoPaterno}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[120px]">{user?.email}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 sm:w-64">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {userData?.nombre} {userData?.apellidoPaterno}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  {userData?.role && (
                    <span className="mt-1 inline-block px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
                      {userData.role.toUpperCase()}
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/perfil">Mi Perfil</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/configuracion">Configuración</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/cambiar-contrasena">Cambiar Contraseña</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  )
}
