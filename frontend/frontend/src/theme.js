// ============================================================
// CodeTutor Design System — Single source of truth
// ============================================================
// All components should import from here instead of hard-coding
// colors, spacing, radii, and shadows inline.
// ============================================================

// ── Colour palette ──────────────────────────────────────────
export const colors = {
  // Brand
  primary:       '#2563EB',   // blue-600
  primaryHover:  '#1D4ED8',   // blue-700
  primaryLight:  '#EFF6FF',   // blue-50
  primaryBorder: '#BFDBFE',   // blue-200

  // AI / Teal accent
  accent:        '#0D9488',   // teal-600
  accentHover:   '#0F766E',   // teal-700
  accentLight:   '#F0FDFA',   // teal-50
  accentBorder:  '#99F6E4',   // teal-200

  // Semantic
  success:       '#16A34A',   // green-600
  successHover:  '#15803D',   // green-700
  successLight:  '#F0FDF4',   // green-50
  successBorder: '#BBF7D0',   // green-200

  danger:        '#DC2626',   // red-600
  dangerHover:   '#B91C1C',   // red-700
  dangerLight:   '#FEF2F2',   // red-50
  dangerBorder:  '#FECACA',   // red-200

  warning:       '#D97706',   // amber-600
  warningHover:  '#B45309',   // amber-700
  warningLight:  '#FFFBEB',   // amber-50
  warningBorder: '#FDE68A',   // amber-200

  // Neutrals
  text:          '#111827',   // gray-900
  textSecondary: '#4B5563',   // gray-600
  textMuted:     '#9CA3AF',   // gray-400
  border:        '#E5E7EB',   // gray-200
  divider:       '#F3F4F6',   // gray-100
  bg:            '#F9FAFB',   // gray-50
  surface:       '#FFFFFF',
  backdrop:      'rgba(0, 0, 0, 0.5)',
};

// ── Spacing ─────────────────────────────────────────────────
export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl: 32,
};

// ── Border Radius ───────────────────────────────────────────
export const radii = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 9999,
};

// ── Shadows ─────────────────────────────────────────────────
export const shadows = {
  sm:    '0 1px 3px rgba(0,0,0,0.08)',
  md:    '0 4px 12px rgba(0,0,0,0.1)',
  lg:    '0 8px 24px rgba(0,0,0,0.12)',
  focus: '0 0 0 3px rgba(37,99,235,0.3)',
};

// ── Typography ──────────────────────────────────────────────
export const font = {
  family:  "'Inter', system-ui, -apple-system, sans-serif",
  mono:    "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  sizeXs:  12,
  sizeSm:  13,
  sizeMd:  15,
  sizeLg:  17,
  sizeXl:  20,
  sizeXxl: 24,
  weightNormal: 400,
  weightMedium: 500,
  weightSemibold: 600,
  weightBold: 700,
};

// ── Transitions ─────────────────────────────────────────────
export const transition = 'all 0.2s ease';

// ============================================================
// Reusable style objects
// ============================================================

// ── Page layout container ───────────────────────────────────
export const pageContainer = (maxWidth = 900) => ({
  padding: spacing.xxl,
  maxWidth,
  margin: '0 auto',
});

// ── Page heading ────────────────────────────────────────────
export const pageHeading = {
  fontSize: font.sizeXxl,
  fontWeight: font.weightBold,
  color: colors.text,
  margin: `0 0 ${spacing.sm}px 0`,
};

export const pageSubheading = {
  fontSize: font.sizeMd,
  color: colors.textSecondary,
  margin: `0 0 ${spacing.xxl}px 0`,
  lineHeight: 1.5,
};

// ── Buttons ─────────────────────────────────────────────────
const btnBase = {
  padding: '12px 24px',
  borderRadius: radii.md,
  border: 'none',
  fontSize: font.sizeMd,
  fontWeight: font.weightSemibold,
  cursor: 'pointer',
  transition,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing.sm,
  lineHeight: 1,
};

export const btn = {
  primary: {
    ...btnBase,
    backgroundColor: colors.primary,
    color: colors.surface,
    boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
  },
  primaryHover: {
    backgroundColor: colors.primaryHover,
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
  },

  accent: {
    ...btnBase,
    backgroundColor: colors.accent,
    color: colors.surface,
    boxShadow: '0 2px 8px rgba(13,148,136,0.25)',
  },
  accentHover: {
    backgroundColor: colors.accentHover,
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(13,148,136,0.35)',
  },

  success: {
    ...btnBase,
    backgroundColor: colors.success,
    color: colors.surface,
    boxShadow: '0 2px 8px rgba(22,163,74,0.25)',
  },
  successHover: {
    backgroundColor: colors.successHover,
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(22,163,74,0.35)',
  },

  danger: {
    ...btnBase,
    backgroundColor: colors.danger,
    color: colors.surface,
    boxShadow: '0 2px 8px rgba(220,38,38,0.2)',
  },
  dangerHover: {
    backgroundColor: colors.dangerHover,
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
  },

  warning: {
    ...btnBase,
    backgroundColor: colors.warning,
    color: colors.surface,
    boxShadow: '0 2px 8px rgba(217,119,6,0.2)',
  },

  outline: {
    ...btnBase,
    backgroundColor: colors.surface,
    color: colors.primary,
    border: `2px solid ${colors.primary}`,
    boxShadow: 'none',
  },
  outlineHover: {
    backgroundColor: colors.primaryLight,
  },

  ghost: {
    ...btnBase,
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    boxShadow: 'none',
  },
  ghostHover: {
    backgroundColor: colors.divider,
    color: colors.text,
  },

  disabled: {
    ...btnBase,
    backgroundColor: colors.border,
    color: colors.textMuted,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },

  small: {
    padding: '8px 16px',
    fontSize: font.sizeSm,
  },
  large: {
    padding: '14px 28px',
    fontSize: font.sizeLg,
  },
};

// ── Cards / panels ──────────────────────────────────────────
export const card = {
  base: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    border: `1px solid ${colors.border}`,
    padding: spacing.xl,
    boxShadow: shadows.sm,
  },
  elevated: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    border: `1px solid ${colors.border}`,
    padding: spacing.xxl,
    boxShadow: shadows.md,
  },
  success: {
    backgroundColor: colors.successLight,
    borderRadius: radii.md,
    border: `2px solid ${colors.successBorder}`,
    padding: spacing.lg,
  },
  danger: {
    backgroundColor: colors.dangerLight,
    borderRadius: radii.md,
    border: `2px solid ${colors.dangerBorder}`,
    padding: spacing.lg,
  },
  warning: {
    backgroundColor: colors.warningLight,
    borderRadius: radii.md,
    border: `2px solid ${colors.warningBorder}`,
    padding: spacing.lg,
  },
  info: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    border: `2px solid ${colors.primaryBorder}`,
    padding: spacing.lg,
  },
  accent: {
    backgroundColor: colors.accentLight,
    borderRadius: radii.md,
    border: `2px solid ${colors.accentBorder}`,
    padding: spacing.lg,
  },
};

// ── Feedback / alert strips ─────────────────────────────────
export const alert = {
  success: {
    padding: '12px 16px',
    borderRadius: radii.md,
    backgroundColor: colors.successLight,
    color: colors.success,
    borderLeft: `4px solid ${colors.success}`,
    fontWeight: font.weightSemibold,
    fontSize: font.sizeMd,
  },
  error: {
    padding: '12px 16px',
    borderRadius: radii.md,
    backgroundColor: colors.dangerLight,
    color: colors.danger,
    borderLeft: `4px solid ${colors.danger}`,
    fontWeight: font.weightSemibold,
    fontSize: font.sizeMd,
  },
  warning: {
    padding: '12px 16px',
    borderRadius: radii.md,
    backgroundColor: colors.warningLight,
    color: colors.warning,
    borderLeft: `4px solid ${colors.warning}`,
    fontWeight: font.weightSemibold,
    fontSize: font.sizeMd,
  },
  info: {
    padding: '12px 16px',
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    color: colors.primary,
    borderLeft: `4px solid ${colors.primary}`,
    fontWeight: font.weightSemibold,
    fontSize: font.sizeMd,
  },
};

// ── Badge ───────────────────────────────────────────────────
export const badge = (bg, textColor) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 10px',
  borderRadius: radii.full,
  fontSize: font.sizeXs,
  fontWeight: font.weightSemibold,
  backgroundColor: bg,
  color: textColor,
  textTransform: 'uppercase',
});

// ── Code output / pre ───────────────────────────────────────
export const codeOutput = {
  background: colors.bg,
  padding: spacing.lg,
  borderRadius: radii.md,
  border: `1px solid ${colors.border}`,
  whiteSpace: 'pre-wrap',
  fontFamily: font.mono,
  fontSize: font.sizeSm,
  maxHeight: 240,
  overflowY: 'auto',
  lineHeight: 1.6,
  color: colors.text,
};

// ── Navbar reference values ─────────────────────────────────
export const navbar = {
  height: 64,
  bg: colors.surface,
  borderColor: colors.border,
  shadow: '0 1px 4px rgba(0,0,0,0.06)',
  brandColor: colors.primary,
};

// ── Sidebar reference values ────────────────────────────────
export const sidebar = {
  width: 280,
  bg: colors.surface,
  shadow: '4px 0 16px rgba(0,0,0,0.1)',
};

// ── Utility helpers ─────────────────────────────────────────
export const hoverLift = (e, up = true) => {
  e.currentTarget.style.transform = up ? 'translateY(-1px)' : 'translateY(0)';
};
