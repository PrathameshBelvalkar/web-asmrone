import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, OctagonXIcon } from "lucide-react"

/** shadcn Sonner, set to the app's dark theme (no next-themes needed). */
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="dark"
    className="toaster group"
    icons={{
      success: <CircleCheckIcon className="size-4 text-primary" />,
      error: <OctagonXIcon className="size-4 text-destructive" />,
    }}
    toastOptions={{
      classNames: {
        toast: "cn-toast !bg-popover !text-popover-foreground !border-border !shadow-lg",
      },
    }}
    {...props}
  />
)

export { Toaster }
