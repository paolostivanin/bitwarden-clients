/**
 * The style of the system tray icon. Only configurable on Linux, where tray icons
 * are commonly monochrome to match the panel.
 */
export const TrayIconStyle = Object.freeze({
  Color: "color",
  White: "white",
  Black: "black",
} as const);
export type TrayIconStyle = (typeof TrayIconStyle)[keyof typeof TrayIconStyle];
