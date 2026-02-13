'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Clock,
  User,
  FileText,
  TrendingUp,
} from 'lucide-react'

interface Notification {
  id: string
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  message: string
  time: string
  icon: React.ComponentType<{ className?: string }>
  read: boolean
}

const notificationTypes = {
  success: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
  info: {
    icon: Info,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  error: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    borderColor: 'border-red-200 dark:border-red-800',
  },
}

const generateNotification = (): Notification => {
  const types: Array<'success' | 'warning' | 'info' | 'error'> = ['success', 'warning', 'info', 'error']
  const type = types[Math.floor(Math.random() * types.length)]
  const config = notificationTypes[type]

  const messages = {
    success: [
      { title: 'Propuesta Aprobada', message: 'La propuesta #1234 ha sido aprobada exitosamente' },
      { title: 'Usuario Creado', message: 'Nuevo usuario registrado en el sistema' },
      { title: 'Proceso Completado', message: 'El proceso de revisión se completó sin errores' },
    ],
    warning: [
      { title: 'Revisión Pendiente', message: 'Hay 5 propuestas esperando revisión urgente' },
      { title: 'Límite Cercano', message: 'Se está alcanzando el límite de almacenamiento' },
      { title: 'Acción Requerida', message: 'Se requiere atención en el proceso de validación' },
    ],
    info: [
      { title: 'Actualización Disponible', message: 'Nueva versión del sistema disponible' },
      { title: 'Reporte Generado', message: 'El reporte mensual ha sido generado correctamente' },
      { title: 'Sistema Operativo', message: 'Todos los servicios están funcionando normalmente' },
    ],
    error: [
      { title: 'Error de Conexión', message: 'Problema temporal con la base de datos' },
      { title: 'Validación Fallida', message: 'Error al validar los datos de la propuesta #5678' },
      { title: 'Proceso Interrumpido', message: 'El proceso de exportación fue interrumpido' },
    ],
  }

  const randomMessage = messages[type][Math.floor(Math.random() * messages[type].length)]
  const minutesAgo = Math.floor(Math.random() * 60)

  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    type,
    title: randomMessage.title,
    message: randomMessage.message,
    time: minutesAgo === 0 ? 'Ahora' : `Hace ${minutesAgo} min`,
    icon: config.icon,
    read: false,
  }
}

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // Generar notificaciones iniciales
    const initialNotifications = Array.from({ length: 5 }, () => generateNotification())
    setNotifications(initialNotifications)
    setUnreadCount(initialNotifications.length)

    // Agregar nueva notificación cada 8-15 segundos
    const interval = setInterval(() => {
      const newNotification = generateNotification()
      setNotifications((prev) => [newNotification, ...prev].slice(0, 10)) // Mantener máximo 10
      setUnreadCount((prev) => prev + 1)
    }, Math.random() * 7000 + 8000) // Entre 8 y 15 segundos

    return () => clearInterval(interval)
  }, [])

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })))
    setUnreadCount(0)
  }

  const removeNotification = (id: string) => {
    const notification = notifications.find((n) => n.id === id)
    if (notification && !notification.read) {
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const unreadNotifications = notifications.filter((n) => !n.read)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 sm:p-5 md:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Notificaciones en Tiempo Real
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leídas'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={markAllAsRead}
              className="w-full sm:w-auto px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              Marcar todas como leídas
            </motion.button>
          )}
        </div>
      </div>

      {/* Lista de notificaciones */}
      <div className="max-h-96 overflow-y-auto">
        <AnimatePresence>
          {notifications.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <Bell className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">No hay notificaciones</p>
            </div>
          ) : (
            notifications.map((notification, index) => {
              const config = notificationTypes[notification.type]
              const Icon = config.icon

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`relative border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${
                    !notification.read
                      ? 'bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-l-primary'
                      : 'bg-white dark:bg-gray-900'
                  } hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`}
                >
                  <div className="p-3 sm:p-4 flex items-start gap-2 sm:gap-3 md:gap-4">
                    {/* Icono */}
                    <div
                      className={`p-1.5 sm:p-2 rounded-lg ${config.bgColor} flex-shrink-0 mt-0.5 sm:mt-1`}
                    >
                      <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${config.color}`} />
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white mb-0.5 sm:mb-1 truncate">
                            {notification.title}
                          </h4>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                            <Clock className="h-3 w-3 text-gray-400 flex-shrink-0" />
                            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                              {notification.time}
                            </span>
                          </div>
                        </div>

                        {/* Indicador de no leído */}
                        {!notification.read && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full flex-shrink-0 mt-1.5 sm:mt-2"
                          />
                        )}
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-start gap-0.5 sm:gap-1 flex-shrink-0">
                      {!notification.read && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => markAsRead(notification.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                          title="Marcar como leída"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeNotification(notification.id)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                        title="Eliminar"
                      >
                        <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-center">
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
            Actualización automática cada 8-15 segundos
          </p>
        </div>
      )}
    </motion.div>
  )
}
