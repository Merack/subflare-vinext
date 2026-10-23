"use client"

import type { CSSProperties } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme, systemTheme } = useTheme()
  const activeTheme = (resolvedTheme ?? systemTheme ?? "light") as "light" | "dark"
  // 提示条用反色，才能从页面背景里跳出来
  const invertedTheme: ToasterProps["theme"] = activeTheme === "dark" ? "light" : "dark"

  return (
    <Sonner
      theme={invertedTheme}
      position="top-center"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": activeTheme === "dark" ? "oklch(1 0 0)" : "oklch(0.145 0 0)",
          "--normal-text": activeTheme === "dark" ? "oklch(0.145 0 0)" : "oklch(0.985 0 0)",
          "--normal-border": activeTheme === "dark" ? "oklch(0.922 0 0)" : "oklch(1 0 0 / 10%)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
