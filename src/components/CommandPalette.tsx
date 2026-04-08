'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  FileText,
  User,
  Settings,
  Lock,
  Search,
  BarChart3,
  Crown,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getHomeRouteForRole, isAdminRole, isSuperAdminRole } from '@/lib/auth/roles'

interface CommandAction {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  action: () => void
  group: string
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const { userData } = useAuth()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const isAdmin = isAdminRole(userData?.role)
  const isSuperAdmin = isSuperAdminRole(userData?.role)

  const commands: CommandAction[] = [
    // Navegación principal
    {
      id: 'dashboard',
      label: isAdmin ? 'Panel Admin' : 'Dashboard',
      icon: LayoutDashboard,
      shortcut: '⌘D',
      action: () => {
        router.push(getHomeRouteForRole(userData?.role) || '/dashboard')
        setOpen(false)
      },
      group: 'Navegación',
    },
    {
      id: 'admin-global',
      label: 'Admin Global',
      icon: Crown,
      action: () => {
        if (isSuperAdmin) {
          router.push('/admin/global')
          setOpen(false)
        }
      },
      group: 'Navegación',
    },
    {
      id: 'propuestas',
      label: 'Propuestas',
      icon: FileText,
      shortcut: '⌘P',
      action: () => {
        if (isAdmin) {
          router.push('/admin/propuestas')
          setOpen(false)
        }
      },
      group: 'Navegación',
    },
    {
      id: 'estadisticas',
      label: 'Estadísticas',
      icon: BarChart3,
      shortcut: '⌘E',
      action: () => {
        if (isAdmin) {
          router.push('/admin/estadisticas')
          setOpen(false)
        }
      },
      group: 'Navegación',
    },
    // Perfil y configuración
    {
      id: 'perfil',
      label: 'Mi Perfil',
      icon: User,
      shortcut: '⌘⇧P',
      action: () => {
        router.push('/admin/perfil')
        setOpen(false)
      },
      group: 'Cuenta',
    },
    {
      id: 'configuracion',
      label: 'Configuración',
      icon: Settings,
      shortcut: '⌘,',
      action: () => {
        router.push('/admin/configuracion')
        setOpen(false)
      },
      group: 'Cuenta',
    },
    {
      id: 'contrasena',
      label: 'Cambiar Contraseña',
      icon: Lock,
      action: () => {
        router.push('/admin/cambiar-contrasena')
        setOpen(false)
      },
      group: 'Cuenta',
    },
    // Búsqueda
    {
      id: 'buscar-propuestas',
      label: 'Buscar Propuestas',
      icon: Search,
      shortcut: '⌘K',
      action: () => {
        if (isAdmin) {
          router.push('/admin/propuestas?search=true')
          setOpen(false)
        }
      },
      group: 'Acciones',
    },
  ]

  // Filtrar comandos según permisos
  const filteredCommands = commands.filter((cmd) => {
    if (cmd.id === 'admin-global') {
      return isSuperAdmin
    }
    if (cmd.id === 'propuestas' || cmd.id === 'estadisticas') {
      return isAdmin
    }
    return true
  })

  // Agrupar comandos
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.group]) {
      acc[cmd.group] = []
    }
    acc[cmd.group].push(cmd)
    return acc
  }, {} as Record<string, CommandAction[]>)

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar comandos..." />
        <CommandList>
          <CommandEmpty>No se encontraron resultados.</CommandEmpty>
          {Object.entries(groupedCommands).map(([group, items]) => (
            <React.Fragment key={group}>
              <CommandGroup heading={group}>
                {items.map((cmd) => {
                  const Icon = cmd.icon
                  return (
                    <CommandItem
                      key={cmd.id}
                      onSelect={cmd.action}
                      className="cursor-pointer"
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span>{cmd.label}</span>
                      {cmd.shortcut && (
                        <CommandShortcut>{cmd.shortcut}</CommandShortcut>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
              <CommandSeparator />
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}
