/**
 * SeverityBadge.tsx
 *
 * Inline badge for hydraulic limits, flow constraints, and system verdicts.
 *
 * Usage:
 *   <SeverityBadge level="danger"  label="Fail" />
 *   <SeverityBadge level="warning" label="Warning" />
 *   <SeverityBadge level="success" label="Pass" />
 *
 * The component uses atlasTokens for colours so the badge is always
 * in sync with the rest of the design system.
 */
import type { CSSProperties } from "react"
import { atlasColors, atlasRadius } from "../../styles/atlasTokens"

export type SeverityLevel = "danger" | "warning" | "success"

interface Props {
  level: SeverityLevel
  label: string
  className?: string
  style?: CSSProperties
  /** Text transform applied to the label. Defaults to "uppercase". */
  textTransform?: CSSProperties["textTransform"]
}

const BADGE_COLOUR: Record<SeverityLevel, string> = {
  danger:  atlasColors.danger,
  warning: atlasColors.warning,
  success: atlasColors.success,
}

export function SeverityBadge({ level, label, className, style, textTransform = "uppercase" }: Props) {
  const badgeStyle: CSSProperties = {
    display:       "inline-flex",
    alignItems:    "center",
    background:    BADGE_COLOUR[level],
    color:         "#fff",
    padding:       "4px 8px",
    borderRadius:  atlasRadius.small,
    fontSize:      "12px",
    fontWeight:    700,
    letterSpacing: "0.04em",
    textTransform,
    whiteSpace:    "nowrap",
    ...style,
  }

  return (
    <span style={badgeStyle} className={className}>
      {label}
    </span>
  )
}
