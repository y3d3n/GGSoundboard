export interface ColorDef {
  id: string
  label: string
  hex: string
}

export const PAD_COLORS: Record<string, ColorDef> = {
  rose: { id: 'rose', label: 'Rose', hex: '#e11d48' },
  orange: { id: 'orange', label: 'Orange', hex: '#ea580c' },
  amber: { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  yellow: { id: 'yellow', label: 'Yellow', hex: '#eab308' },
  emerald: { id: 'emerald', label: 'Emerald', hex: '#059669' },
  teal: { id: 'teal', label: 'Teal', hex: '#0d9488' },
  cyan: { id: 'cyan', label: 'Cyan', hex: '#0891b2' },
  blue: { id: 'blue', label: 'Blue', hex: '#2563eb' },
  indigo: { id: 'indigo', label: 'Indigo', hex: '#4f46e5' },
  purple: { id: 'purple', label: 'Purple', hex: '#9333ea' },
  pink: { id: 'pink', label: 'Pink', hex: '#db2777' },
  slate: { id: 'slate', label: 'Slate', hex: '#475569' },
}

export const COLOR_PRESETS = Object.values(PAD_COLORS)

export function resolveColorHex(color: string | null | undefined): string | null {
  if (!color) return null
  if (color in PAD_COLORS) return PAD_COLORS[color]!.hex
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return color
  return null
}

/**
 * Calculates WCAG relative luminance (0 to 1).
 */
export function getLuminance(hexColor: string): number {
  let c = hexColor.replace('#', '')
  if (c.length === 3) c = c.split('').map((x) => x + x).join('')
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255

  const toLinear = (val: number) => (val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4))
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/**
 * Returns 'black' for light backgrounds and 'white' for dark backgrounds
 * based on WCAG contrast ratio guidelines.
 */
export function getContrastTextColor(hexColor: string): 'black' | 'white' {
  return getLuminance(hexColor) > 0.42 ? 'black' : 'white'
}

export interface PadColorTheme {
  bg: string
  borderColor: string
  playingBg: string
  playingBorderColor: string
  textColor: string
  subTextColor: string
  iconColor: string
  buttonHoverBg: string
  kbd: {
    bg: string
    text: string
    border: string
  }
  progressBg: string
  pulseGlow: string
  isLight: boolean
}

export function computePadTheme(color: string | null | undefined): PadColorTheme | null {
  const hex = resolveColorHex(color)
  if (!hex) return null
  const isLight = getContrastTextColor(hex) === 'black'

  if (isLight) {
    return {
      bg: hex,
      borderColor: 'rgba(0, 0, 0, 0.16)',
      playingBg: hex,
      playingBorderColor: 'rgba(0, 0, 0, 0.45)',
      textColor: '#0a0a0d',
      subTextColor: 'rgba(10, 10, 13, 0.72)',
      iconColor: '#0a0a0d',
      buttonHoverBg: 'rgba(0, 0, 0, 0.12)',
      kbd: {
        bg: 'rgba(0, 0, 0, 0.14)',
        text: '#0a0a0d',
        border: 'rgba(0, 0, 0, 0.22)',
      },
      progressBg: '#0a0a0d',
      pulseGlow: 'rgba(0, 0, 0, 0.3)',
      isLight: true,
    }
  }

  return {
    bg: hex,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    playingBg: hex,
    playingBorderColor: 'rgba(255, 255, 255, 0.65)',
    textColor: '#ffffff',
    subTextColor: 'rgba(255, 255, 255, 0.76)',
    iconColor: '#ffffff',
    buttonHoverBg: 'rgba(255, 255, 255, 0.16)',
    kbd: {
      bg: 'rgba(255, 255, 255, 0.18)',
      text: '#ffffff',
      border: 'rgba(255, 255, 255, 0.28)',
    },
    progressBg: '#ffffff',
    pulseGlow: 'rgba(255, 255, 255, 0.4)',
    isLight: false,
  }
}
