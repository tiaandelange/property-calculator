/** Standard icon pixel sizes — inherit colour via currentColor. */
export const ICON_SIZE_PX = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24
} as const;

export type IconSize = keyof typeof ICON_SIZE_PX;

export const ICON_CONTAINER_SIZE_PX = {
  sm: 32,
  md: 40,
  lg: 44,
  xl: 48
} as const;

export type IconContainerSize = keyof typeof ICON_CONTAINER_SIZE_PX;
