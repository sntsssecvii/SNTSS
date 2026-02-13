'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
}

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode
}

interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6"
      onClick={() => onOpenChange(false)}
    >
      <div className="fixed inset-0 bg-black/50" />
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="w-full max-h-full overflow-auto flex items-center justify-center"
      >
        {children}
      </div>
    </div>
  )
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative z-50 grid w-full max-w-lg gap-4 border bg-background p-4 sm:p-5 md:p-6 shadow-lg rounded-lg sm:rounded-lg max-h-[95vh] overflow-y-auto mx-auto',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({ className, children, ...props }: DialogHeaderProps) => {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
      {...props}
    >
      {children}
    </div>
  )
}

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h2
        ref={ref}
        className={cn('text-lg font-semibold leading-none tracking-tight', className)}
        {...props}
      >
        {children}
      </h2>
    )
  }
)
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      >
        {children}
      </p>
    )
  }
)
DialogDescription.displayName = 'DialogDescription'

const DialogFooter = ({ className, children, ...props }: DialogFooterProps) => {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    >
      {children}
    </div>
  )
}

const DialogClose = ({ onClose }: { onClose: () => void }) => {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute right-2 top-2 sm:right-4 sm:top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 h-8 w-8 sm:h-9 sm:w-9"
      onClick={onClose}
    >
      <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      <span className="sr-only">Cerrar</span>
    </Button>
  )
}

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
}
