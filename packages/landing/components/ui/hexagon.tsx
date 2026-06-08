"use client"
import type { CSSProperties, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export type HexagonBackgroundProps = {
  className?: string
  glowColor: string
  borderColor: string
  children?: ReactNode
  hexagonSize?: number
  hexagonMargin?: number
}

export function HexagonBackground({
  children,
  className,
  hexagonSize = 60,
  hexagonMargin = 2,
  borderColor = "color-mix(in oklch, var(--border) 42%, transparent)",
  glowColor = "color-mix(in oklch, var(--primary) 42%, transparent)",
}: HexagonBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [grid, setGrid] = useState({ rows: 0, cols: 0, scale: 1 })

  const hexWidth = hexagonSize
  const hexHeight = hexagonSize * 1.15
  const rowSpacing = hexagonSize * 0.86

  const updateGrid = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const { width, height } = container.getBoundingClientRect()
    const scale = Math.max(1, Math.min(width, height) / 800)
    const scaledSize = hexagonSize * scale
    const cols = Math.ceil(width / scaledSize) + 2
    const rows = Math.ceil(height / (scaledSize * 0.86)) + 2
    setGrid({ rows, cols, scale })
  }, [hexagonSize])

  useEffect(() => {
    updateGrid()
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(updateGrid)
    ro.observe(container)
    return () => ro.disconnect()
  }, [updateGrid])

  const scaledHexWidth = hexWidth * grid.scale
  const scaledHexHeight = hexHeight * grid.scale
  const scaledRowSpacing = rowSpacing * grid.scale
  const scaledMargin = hexagonMargin * grid.scale

  const hexagonStyle = useMemo(
    () =>
      ({
        width: scaledHexWidth,
        height: scaledHexHeight,
        marginLeft: scaledMargin,
        "--glow-color": glowColor,
        "--border-color": borderColor,
        "--margin": `${scaledMargin}px`,
      }) as CSSProperties,
    [scaledHexWidth, scaledHexHeight, scaledMargin, glowColor, borderColor]
  )

  return (
    <div
      ref={containerRef}
      aria-hidden={children ? undefined : true}
      className={cn(
        "absolute inset-0 overflow-hidden bg-background",
        className
      )}
    >
      <div className="absolute inset-0 overflow-hidden opacity-80">
        {Array.from({ length: grid.rows }).map((_, rowIndex) => {
          const isOddRow = rowIndex % 2 === 1
          const marginLeft = isOddRow
            ? -(scaledHexWidth / 2) + scaledMargin
            : scaledMargin
          return (
            <div
              key={rowIndex}
              className="flex"
              style={{
                marginTop:
                  rowIndex === 0
                    ? -scaledHexHeight * 0.25
                    : -scaledRowSpacing * 0.16,
                marginLeft: marginLeft - scaledHexWidth * 0.1,
              }}
            >
              {Array.from({ length: grid.cols }).map((_, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={cn(
                    "relative shrink-0 transition-colors duration-700",
                    "[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] ease-out",
                    "before:absolute before:inset-0 before:bg-[var(--border-color)] before:transition-colors before:duration-700",
                    "after:absolute after:inset-(--margin) after:bg-background after:transition-colors after:duration-500",
                    "after:[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]",
                    "hover:before:bg-[var(--glow-color)] hover:before:shadow-[0_0_20px_var(--glow-color)] hover:before:duration-0",
                    "hover:after:bg-card hover:after:duration-0"
                  )}
                  style={hexagonStyle}
                />
              ))}
            </div>
          )
        })}
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, color-mix(in oklch, var(--primary) 20%, transparent) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, color-mix(in oklch, var(--primary) 10%, transparent) 0%, transparent 52%)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, transparent 40%, var(--background) 100%)",
        }}
      />

      {children && (
        <div className="relative z-10 h-full w-full">{children}</div>
      )}
    </div>
  )
}
