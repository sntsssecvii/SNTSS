import { ROLES, PERMISOS, PERMISOS_POR_ROL, tienePermiso, tieneAlgunPermiso, tieneTodosPermisos } from '@/types/roles'
import type { UserRole } from '@/types/roles'
import React from 'react'

/**
 * Hook para verificar permisos (para usar en componentes)
 */
export const usePermissions = (rol: UserRole | undefined) => {
  return {
    puede: (permiso: PERMISOS) => tienePermiso(rol, permiso),
    puedeAlguno: (permisos: PERMISOS[]) => tieneAlgunPermiso(rol, permisos),
    puedeTodos: (permisos: PERMISOS[]) => tieneTodosPermisos(rol, permisos),
    esAdmin: () => rol === ROLES.ADMIN || rol === ROLES.SUPER_ADMIN,
    esSuperAdmin: () => rol === ROLES.SUPER_ADMIN,
    esRevisor: () => rol === ROLES.REVISOR,
    esCapturista: () => rol === ROLES.CAPTURISTA,
    esConsulta: () => rol === ROLES.CONSULTA,
  }
}

/**
 * Componente HOC para proteger rutas basado en permisos
 */
export const withPermission = <P extends object>(
  Component: React.ComponentType<P>,
  permisoRequerido: PERMISOS,
  FallbackComponent?: React.ComponentType
) => {
  const WrappedComponent = (props: P & { rol?: UserRole }) => {
    const { rol, ...restProps } = props

    if (!tienePermiso(rol, permisoRequerido)) {
      if (FallbackComponent) {
        return <FallbackComponent />
      }
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
            <p className="text-muted-foreground">
              No tienes permisos para acceder a esta sección.
            </p>
          </div>
        </div>
      )
    }

    return <Component {...(restProps as P)} />
  }

  WrappedComponent.displayName = `withPermission(${Component.displayName || Component.name || 'Component'})`

  return WrappedComponent
}

/**
 * Función helper para verificar permisos en el servidor o cliente
 */
export const checkPermission = (rol: UserRole | undefined, permiso: PERMISOS): boolean => {
  return tienePermiso(rol, permiso)
}

/**
 * Obtener todos los permisos de un rol
 */
export const getPermisosPorRol = (rol: UserRole | undefined): PERMISOS[] => {
  if (!rol) return []
  const roleValue = typeof rol === 'string' ? ROLES[rol as keyof typeof ROLES] : rol
  return PERMISOS_POR_ROL[roleValue] || []
}
