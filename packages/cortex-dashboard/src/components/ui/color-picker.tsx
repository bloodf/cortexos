"use client"

import * as React from "react"
import { HexColorPicker } from "react-colorful"
import { cn } from "@/lib/utils"

/**
 * Compute WCAG AA-compliant text color for a given hex background.
 * Returns '#000000' or '#ffffff' depending on relative luminance.
 */
export function pickTextColor(bgHex: string): "#000000" | "#ffffff" {
  const hex = bgHex.replace("#", "")
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255

  const linearize = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

  const luminance =
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)

  // WCAG contrast ratio vs white = (luminance + 0.05) / 0.05
  // contrast ratio vs black = 1.05 / (luminance + 0.05)
  // Pick whichever gives contrast >= 4.5:1
  const contrastOnWhite = (luminance + 0.05) / 0.05
  return contrastOnWhite >= 4.5 ? "#000000" : "#ffffff"
}

interface ColorPickerValue {
  color: string
  textColor: "#000000" | "#ffffff"
}

interface ColorPickerProps {
  value?: string
  onChange?: (value: ColorPickerValue) => void
  className?: string
  previewLabel?: string
}

function ColorPicker({
  value = "#2563eb",
  onChange,
  className,
  previewLabel,
}: ColorPickerProps) {
  const [color, setColor] = React.useState(value)
  const [lastValue, setLastValue] = React.useState(value)

  // Reset local color when controlled value prop changes (derived state pattern).
  if (value !== lastValue) {
    setLastValue(value)
    setColor(value)
  }

  const handleChange = (newColor: string) => {
    setColor(newColor)
    onChange?.({ color: newColor, textColor: pickTextColor(newColor) })
  }

  const textColor = pickTextColor(color)

  return (
    <div
      data-slot="color-picker"
      className={cn("flex flex-col gap-3", className)}
    >
      <HexColorPicker color={color} onChange={handleChange} />

      {/* Live preview */}
      <div
        data-slot="color-picker-preview"
        className="flex h-10 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors"
        style={{ backgroundColor: color, color: textColor }}
      >
        {previewLabel ?? color.toUpperCase()}
      </div>

      {/* Hex input */}
      <input
        type="text"
        value={color}
        maxLength={7}
        onChange={(e) => {
          const v = e.target.value
          if (/^#[0-9a-fA-F]{0,6}$/.test(v)) handleChange(v)
        }}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        aria-label="Hex color value"
      />
    </div>
  )
}

export { ColorPicker }
export type { ColorPickerProps, ColorPickerValue }
