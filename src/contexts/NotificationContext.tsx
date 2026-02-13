'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { Notification, listenToNotifications, markNotificationAsRead, markAllAsRead as markAllAsReadFirebase } from '@/lib/firebase/notifications'

interface NotificationContextType {
    notifications: Notification[]
    unreadCount: number
    loading: boolean
    markAsRead: (id: string) => Promise<void>
    markAllAsRead: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user) {
            setNotifications([])
            setLoading(false)
            return
        }

        const unsubscribe = listenToNotifications(user.uid, (data) => {
            setNotifications(data)
            setLoading(false)
        })

        return () => unsubscribe()
    }, [user])

    const unreadCount = notifications.filter(n => !n.read).length

    const markAsRead = async (id: string) => {
        await markNotificationAsRead(id)
    }

    const markAllAsRead = async () => {
        if (user) {
            await markAllAsReadFirebase(user.uid)
        }
    }

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            markAsRead,
            markAllAsRead
        }}>
            {children}
        </NotificationContext.Provider>
    )
}

export function useNotifications() {
    const context = useContext(NotificationContext)
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider')
    }
    return context
}
