import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-md font-semibold tracking-[0.02em] transition-all duration-200 ease-in-out cursor-pointer border-0 relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:before:w-0 disabled:hover:before:h-0 before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:w-0 before:h-0 before:rounded-full before:bg-white/20 before:-translate-x-1/2 before:-translate-y-1/2 before:transition-[width,height] before:duration-600 hover:before:w-[300px] hover:before:h-[300px] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 gap-2",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-primary text-text-primary shadow-button-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-[linear-gradient(135deg,var(--color-primary-dark)0%,var(--color-primary-darker)100%)] hover:shadow-button-primary-hover hover:-translate-y-px focus:outline-none focus:shadow-button-primary-hover focus:ring-3 focus:ring-purple-500/30",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-slate-700 bg-transparent hover:bg-slate-800 text-slate-200",
        secondary:
          "bg-gradient-bg-button-secondary text-slate-200 border border-slate-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-gradient-bg-button-secondary-hover hover:border-purple-500/40 hover:text-text-primary hover:-translate-y-px hover:shadow-card focus:outline-none focus:border-primary focus:shadow-[0_4px_12px_rgba(0,0,0,0.3),0_0_0_3px_rgba(139,92,246,0.2)]",
        ghost: "hover:bg-slate-800 hover:text-slate-100",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "px-2xl py-[0.625rem]",
        sm: "h-8 rounded-md px-3 text-sm",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
