'use server'

import { Resend } from 'resend'
import {
    registrationTemplate,
    approvalTemplate,
    rejectionTemplate,
    passwordResetTemplate
} from './email-templates'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM || 'SNTSS Sección VII <notificaciones@sntssvii.com>'

interface EmailPayload {
    to: string
    subject: string
    html: string
}

export async function sendEmail(payload: EmailPayload) {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY no está configurada')
    }

    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: payload.to,
            subject: payload.subject,
            html: payload.html,
        })

        if (error) {
            console.error('❌ [Email] Error de Resend:', error)
            throw new Error(typeof error.message === 'string' ? error.message : 'RESEND_SEND_FAILED')
        }

        console.log('✅ [Email] Enviado exitosamente:', data?.id)
        return { success: true, data }
    } catch (error) {
        console.error('❌ [Email] Error crítico enviando correo:', error)
        throw error
    }
}

export async function sendRegistrationEmail(to: string, name: string) {
    return sendEmail({
        to,
        subject: "Confirmación de Registro - SNTSS Sección VII",
        html: registrationTemplate(name),
    })
}

export async function sendApprovalEmail(to: string, name: string) {
    return sendEmail({
        to,
        subject: "¡Cuenta Activada! - SNTSS Sección VII",
        html: approvalTemplate(name),
    })
}

export async function sendRejectionEmail(to: string, name: string, reason: string) {
    return sendEmail({
        to,
        subject: "Actualización de Registro - SNTSS Sección VII",
        html: rejectionTemplate(name, reason),
    })
}

export async function sendPasswordResetEmail(to: string, name: string, resetLink: string) {
    return sendEmail({
        to,
        subject: "Restablecer Contraseña - SNTSS Sección VII",
        html: passwordResetTemplate(name, resetLink),
    })
}
