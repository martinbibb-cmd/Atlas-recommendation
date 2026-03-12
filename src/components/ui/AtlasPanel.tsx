/**
 * AtlasPanel.tsx
 *
 * Reusable surface container for Atlas UI.
 *
 * Variants:
 *   default  — neutral white panel (standard card)
 *   focus    — indigo-bordered, glass-blur focus panel (primary results)
 *   warning  — amber-tinted warning surface
 *   danger   — red-tinted danger / fail surface
 *   success  — green-tinted pass surface
 *
 * Usage:
 *   <AtlasPanel>…</AtlasPanel>
 *   <AtlasPanel variant="focus">…</AtlasPanel>
 *   <AtlasPanel variant="warning">…</AtlasPanel>
 *
 * The component forwards an optional `className` so callers can layer
 * additional utility classes without overriding the base styles.
 */
import type { CSSProperties, ReactNode } from "react"
import { atlasColors, atlasRadius, atlasShadows } from "../../styles/atlasTokens"

export type AtlasPanelVariant = "default" | "focus" | "warning" | "danger" | "success"

interface Props {
  variant?: AtlasPanelVariant
  className?: string
  style?: CSSProperties
  children: ReactNode
}

const BORDER_COLOUR: Record<AtlasPanelVariant, string> = {
  default: atlasColors.divider,
  focus:   atlasColors.atlasBlue,
  warning: atlasColors.warning,
  danger:  atlasColors.danger,
  success: atlasColors.success,
}

export function AtlasPanel({ variant = "default", className, style, children }: Props) {
  const isFocus = variant === "focus"

  const background = isFocus ? atlasColors.surfaceFocus : atlasColors.surface
  const backdrop   = isFocus ? "blur(10px)" : undefined

  const baseStyle: CSSProperties = {
    background,
    border:       `1px solid ${BORDER_COLOUR[variant]}`,
    borderRadius: atlasRadius.panel,
    boxShadow:    atlasShadows.panel,
    padding:      "16px",
    ...(backdrop ? { backdropFilter: backdrop, WebkitBackdropFilter: backdrop } : {}),
    ...style,
  }

  return (
    <div style={baseStyle} className={className}>
      {children}
    </div>
  )
}
