export enum ROLES {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  REVISOR = 'REVISOR',
  CAPTURISTA = 'CAPTURISTA',
  CONSULTA = 'CONSULTA',
  USER = 'USER', // Mantener para compatibilidad
}

export type UserRole = ROLES | keyof typeof ROLES;

// Permisos disponibles en el sistema
export enum PERMISOS {
  // Propuestas
  CREAR_PROPUESTA = 'CREAR_PROPUESTA',
  EDITAR_PROPUESTA = 'EDITAR_PROPUESTA',
  ELIMINAR_PROPUESTA = 'ELIMINAR_PROPUESTA',
  VER_PROPUESTA = 'VER_PROPUESTA',
  APROBAR_PROPUESTA = 'APROBAR_PROPUESTA',
  RECHAZAR_PROPUESTA = 'RECHAZAR_PROPUESTA',
  ENVIAR_PROPUESTA_IMSS = 'ENVIAR_PROPUESTA_IMSS',
  
  // Usuarios
  CREAR_USUARIO = 'CREAR_USUARIO',
  EDITAR_USUARIO = 'EDITAR_USUARIO',
  ELIMINAR_USUARIO = 'ELIMINAR_USUARIO',
  VER_USUARIOS = 'VER_USUARIOS',
  
  // Reportes
  VER_REPORTES = 'VER_REPORTES',
  EXPORTAR_REPORTES = 'EXPORTAR_REPORTES',
  
  // Configuración
  CONFIGURAR_SISTEMA = 'CONFIGURAR_SISTEMA',
  VER_CONFIGURACION = 'VER_CONFIGURACION',
  
  // Estadísticas
  VER_ESTADISTICAS = 'VER_ESTADISTICAS',
  
  // Notificaciones
  ENVIAR_NOTIFICACIONES = 'ENVIAR_NOTIFICACIONES',
  
  // Bolsa de Trabajo
  CARGAR_BOLSA_TRABAJO = 'CARGAR_BOLSA_TRABAJO',
  PROCESAR_BOLSA_TRABAJO = 'PROCESAR_BOLSA_TRABAJO',
  VER_BOLSA_TRABAJO = 'VER_BOLSA_TRABAJO',
  VALIDAR_BOLSA_TRABAJO = 'VALIDAR_BOLSA_TRABAJO',
  ELIMINAR_BOLSA_TRABAJO = 'ELIMINAR_BOLSA_TRABAJO',
  EXPORTAR_BOLSA_TRABAJO = 'EXPORTAR_BOLSA_TRABAJO',
}

// Mapeo de roles a permisos
export const PERMISOS_POR_ROL: Record<ROLES, PERMISOS[]> = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISOS), // Todos los permisos
  
  [ROLES.ADMIN]: [
    PERMISOS.CREAR_PROPUESTA,
    PERMISOS.EDITAR_PROPUESTA,
    PERMISOS.ELIMINAR_PROPUESTA,
    PERMISOS.VER_PROPUESTA,
    PERMISOS.APROBAR_PROPUESTA,
    PERMISOS.RECHAZAR_PROPUESTA,
    PERMISOS.ENVIAR_PROPUESTA_IMSS,
    PERMISOS.VER_USUARIOS,
    PERMISOS.VER_REPORTES,
    PERMISOS.EXPORTAR_REPORTES,
    PERMISOS.VER_ESTADISTICAS,
    PERMISOS.ENVIAR_NOTIFICACIONES,
    PERMISOS.CARGAR_BOLSA_TRABAJO,
    PERMISOS.PROCESAR_BOLSA_TRABAJO,
    PERMISOS.VER_BOLSA_TRABAJO,
    PERMISOS.VALIDAR_BOLSA_TRABAJO,
    PERMISOS.ELIMINAR_BOLSA_TRABAJO,
    PERMISOS.EXPORTAR_BOLSA_TRABAJO,
  ],
  
  [ROLES.REVISOR]: [
    PERMISOS.VER_PROPUESTA,
    PERMISOS.APROBAR_PROPUESTA,
    PERMISOS.RECHAZAR_PROPUESTA,
    PERMISOS.VER_REPORTES,
    PERMISOS.VER_ESTADISTICAS,
    PERMISOS.VER_BOLSA_TRABAJO,
    PERMISOS.VALIDAR_BOLSA_TRABAJO,
    PERMISOS.EXPORTAR_BOLSA_TRABAJO,
  ],
  
  [ROLES.CAPTURISTA]: [
    PERMISOS.CREAR_PROPUESTA,
    PERMISOS.EDITAR_PROPUESTA,
    PERMISOS.VER_PROPUESTA,
  ],
  
  [ROLES.CONSULTA]: [
    PERMISOS.VER_PROPUESTA,
    PERMISOS.VER_REPORTES,
    PERMISOS.VER_ESTADISTICAS,
    PERMISOS.VER_BOLSA_TRABAJO,
    PERMISOS.EXPORTAR_BOLSA_TRABAJO,
  ],
  
  [ROLES.USER]: [
    PERMISOS.VER_PROPUESTA,
  ],
}

// Helper functions para comparar roles
export const isRole = (role: string): role is UserRole => {
  return Object.values(ROLES).includes(role as ROLES);
};

export const compareRoles = (role1: UserRole | undefined, role2: ROLES): boolean => {
  if (!role1) return false;
  return getRoleValue(role1) === role2;
};

export const getRoleValue = (role: UserRole): ROLES => {
  return typeof role === 'string' ? ROLES[role as keyof typeof ROLES] || role as ROLES : role;
};

// Verificar si un rol tiene un permiso específico
export const tienePermiso = (rol: UserRole | undefined, permiso: PERMISOS): boolean => {
  if (!rol) return false;
  const roleValue = getRoleValue(rol);
  const permisos = PERMISOS_POR_ROL[roleValue] || [];
  return permisos.includes(permiso);
};

// Verificar si un rol tiene al menos uno de los permisos
export const tieneAlgunPermiso = (rol: UserRole | undefined, permisos: PERMISOS[]): boolean => {
  return permisos.some(permiso => tienePermiso(rol, permiso));
};

// Verificar si un rol tiene todos los permisos
export const tieneTodosPermisos = (rol: UserRole | undefined, permisos: PERMISOS[]): boolean => {
  return permisos.every(permiso => tienePermiso(rol, permiso));
};
