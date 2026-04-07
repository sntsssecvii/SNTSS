'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { auth } from '@/lib/firebase/firebase-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { getRoleLabel } from '@/lib/auth/roles'
import { ROLES } from '@/types/roles'
import { AlertTriangle, BadgeCheck, Loader2, Search, Shield, Users } from 'lucide-react'

type UserStatus = 'pending' | 'active' | 'rejected'

type ManagedUser = {
  uid: string
  email: string
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  matricula: string
  curp: string
  role: string
  status: UserStatus
  createdAtMs: number | null
  updatedAtMs: number | null
}

type PendingChanges = Record<string, { role: string; status: UserStatus }>
type PaginationState = {
  total: number
  limit: number
  nextCursor: string | null
  hasMore: boolean
}

const DEFAULT_PAGINATION: PaginationState = {
  total: 0,
  limit: 25,
  nextCursor: null,
  hasMore: false,
}

const ROLE_OPTIONS = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.REVISOR,
  ROLES.CAPTURISTA,
  ROLES.CONSULTA,
  ROLES.USER,
]

function getStatusBadgeVariant(status: UserStatus) {
  if (status === 'active') return 'success'
  if (status === 'rejected') return 'destructive'
  return 'warning'
}

function formatStatusLabel(status: UserStatus) {
  if (status === 'active') return 'Activo'
  if (status === 'rejected') return 'Rechazado'
  return 'Pendiente'
}

export default function AdminGlobalManager() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [savingUid, setSavingUid] = useState<string | null>(null)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL')
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({})
  const [pagination, setPagination] = useState<PaginationState>(DEFAULT_PAGINATION)
  const [summary, setSummary] = useState({ total: 0, superAdmins: 0, active: 0, pending: 0 })
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined)
  const deferredQuery = useDeferredValue(query)

  const loadUsers = useCallback(async (cursor?: string) => {
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('AUTH_REQUIRED')
    }

    const idToken = await currentUser.getIdToken()
    const searchParams = new URLSearchParams({
      limit: '25',
      status: statusFilter,
      role: roleFilter,
    })

    if (deferredQuery.trim()) {
      searchParams.set('q', deferredQuery.trim())
    }

    if (cursor) {
      searchParams.set('cursor', cursor)
    }

    const response = await fetch(`/api/admin/global/usuarios?${searchParams.toString()}`, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    })
    const payload = await response.json() as {
      data?: {
        usuarios?: ManagedUser[]
        pagination?: PaginationState
        summary?: { total: number; superAdmins: number; active: number; pending: number }
      }
      error?: string
    }

    if (!response.ok || !payload?.data?.usuarios) {
      throw new Error(payload?.error || 'No se pudo cargar la administración global.')
    }

    setUsers(payload.data.usuarios)
    setPagination(payload.data.pagination || DEFAULT_PAGINATION)
    setSummary(payload.data.summary || { total: 0, superAdmins: 0, active: 0, pending: 0 })
    setPendingChanges({})
    setCurrentCursor(cursor)
  }, [deferredQuery, roleFilter, statusFilter])

  useEffect(() => {
    let cancelled = false

    const syncUsers = async () => {
      try {
        if (!cancelled) setLoading(true)
        setCursorStack([])
        setCurrentCursor(undefined)
        await loadUsers()
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          toast({
            title: 'Error',
            description: 'No se pudo cargar la administración global.',
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    syncUsers()

    return () => {
      cancelled = true
    }
  }, [loadUsers, toast])

  const filteredUsers = useMemo(() => users, [users])

  const handleFieldChange = (uid: string, field: 'role' | 'status', value: string) => {
    setPendingChanges((current) => {
      const target = current[uid] || {
        role: users.find((user) => user.uid === uid)?.role || ROLES.USER,
        status: users.find((user) => user.uid === uid)?.status || 'pending',
      }

      return {
        ...current,
        [uid]: {
          ...target,
          [field]: value,
        },
      }
    })
  }

  const handleSave = async (uid: string) => {
    const change = pendingChanges[uid]
    if (!change) return

    setSavingUid(uid)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('AUTH_REQUIRED')
      }

      const idToken = await currentUser.getIdToken()
      const response = await fetch(`/api/admin/global/usuarios/${uid}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(change),
      })
      const payload = await response.json() as { data?: { role?: string; status?: UserStatus }; error?: string }

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || 'No se pudo guardar el cambio.')
      }

      setUsers((current) =>
        current.map((user) =>
          user.uid === uid
            ? {
                ...user,
                role: payload.data?.role || user.role,
                status: payload.data?.status || user.status,
              }
            : user
        )
      )

      setPendingChanges((current) => {
        const next = { ...current }
        delete next[uid]
        return next
      })

      toast({
        title: 'Usuario actualizado',
        description: 'Los cambios de rol y estatus se guardaron correctamente.',
      })
    } catch (error) {
      console.error(error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo guardar el cambio.',
        variant: 'destructive',
      })
    } finally {
      setSavingUid(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-12 dark:border-slate-800 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[2rem] border-slate-200/70 dark:border-slate-800">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Usuarios</p>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{summary.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-slate-200/70 dark:border-slate-800">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Admins Globales</p>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{summary.superAdmins}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-slate-200/70 dark:border-slate-800">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Activos</p>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{summary.active}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-slate-200/70 dark:border-slate-800">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-600 dark:bg-yellow-950/30 dark:text-yellow-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Pendientes</p>
              <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{summary.pending}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[2rem] border-slate-200/70 dark:border-slate-800">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-black tracking-tight">Gobierno de usuarios</CardTitle>
          <CardDescription>
            Administra accesos internos. Los cambios de rol y estatus quedan auditados.
            La búsqueda textual filtra la página actual; rol y estatus consultan al backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,0.5fr)_minmax(180px,0.5fr)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, correo o matrícula"
                className="pl-9"
              />
            </div>

            <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="ALL">Todos los roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {getRoleLabel(role)}
                </option>
              ))}
            </Select>

            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'ALL' | UserStatus)}
            >
              <option value="ALL">Todos los estatus</option>
              <option value="active">Activos</option>
              <option value="pending">Pendientes</option>
              <option value="rejected">Rechazados</option>
            </Select>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200/70 dark:border-slate-800">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead>Alta</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                        No hay usuarios que coincidan con los filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const draft = pendingChanges[user.uid]
                      const selectedRole = draft?.role || user.role
                      const selectedStatus = draft?.status || user.status
                      const changed = selectedRole !== user.role || selectedStatus !== user.status

                      return (
                        <TableRow key={user.uid}>
                          <TableCell className="min-w-[240px]">
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {user.nombre} {user.apellidoPaterno} {user.apellidoMaterno}
                              </p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{user.matricula || 'Sin matrícula'}</TableCell>
                          <TableCell className="min-w-[180px]">
                            <Select
                              value={selectedRole}
                              onChange={(event) => handleFieldChange(user.uid, 'role', event.target.value)}
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                  {getRoleLabel(role)}
                                </option>
                              ))}
                            </Select>
                          </TableCell>
                          <TableCell className="min-w-[170px] space-y-2">
                            <Badge variant={getStatusBadgeVariant(selectedStatus)} className="mb-2">
                              {formatStatusLabel(selectedStatus)}
                            </Badge>
                            <Select
                              value={selectedStatus}
                              onChange={(event) => handleFieldChange(user.uid, 'status', event.target.value)}
                            >
                              <option value="active">Activo</option>
                              <option value="pending">Pendiente</option>
                              <option value="rejected">Rechazado</option>
                            </Select>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {user.createdAtMs ? new Date(user.createdAtMs).toLocaleDateString('es-MX') : 'Sin fecha'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              disabled={!changed || savingUid === user.uid}
                              onClick={() => handleSave(user.uid)}
                            >
                              {savingUid === user.uid ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Guardando
                                </>
                              ) : (
                                'Guardar cambios'
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Mostrando {filteredUsers.length} de {pagination.total} usuarios para los filtros actuales.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  const nextStack = cursorStack.slice(0, -1)
                  setCursorStack(nextStack)
                  await loadUsers(nextStack[nextStack.length - 1])
                }}
                disabled={cursorStack.length === 0}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  if (!pagination.nextCursor) return
                  setCursorStack((current) => [...current, currentCursor || ''])
                  await loadUsers(pagination.nextCursor)
                }}
                disabled={!pagination.hasMore || !pagination.nextCursor}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
