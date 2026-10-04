import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Focus is drawn by the global :focus-visible outline, which follows the tone's --ring.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-200 select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // A pressed-ink edge under the button instead of a soft drop shadow.
        default:
          "bg-primary text-primary-foreground shadow-[0_3px_0_color-mix(in_srgb,var(--primary)_55%,var(--ink))] hover:bg-[color-mix(in_srgb,var(--primary)_88%,var(--ink))] active:shadow-[0_1px_0_color-mix(in_srgb,var(--primary)_55%,var(--ink))]",
        outline:
          "border-[color-mix(in_srgb,var(--foreground)_30%,transparent)] bg-transparent text-foreground hover:border-foreground hover:bg-accent aria-expanded:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_srgb,var(--secondary),var(--foreground)_6%)] aria-expanded:bg-secondary",
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent",
        destructive:
          "bg-destructive text-primary-foreground hover:bg-[color-mix(in_srgb,var(--destructive)_88%,var(--ink))]",
        link: "rounded-sm text-primary underline decoration-1 underline-offset-4 hover:decoration-2",
      },
      size: {
        default:
          "h-11 px-5 text-base has-data-[icon=inline-end]:pe-4 has-data-[icon=inline-start]:ps-4",
        xs: "h-8 gap-1 px-3 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 px-4 text-sm",
        lg: "h-13 gap-2.5 px-7 text-lg [&_svg:not([class*='size-'])]:size-5",
        icon: "size-11",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9",
        "icon-lg": "size-13",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
