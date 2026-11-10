import type { CSSProperties, HTMLAttributes } from "react";
import "./LineMdIcon.css";

export const LINE_MD_ICON_NAMES = [
  "account",
  "account-add",
  "alert",
  "arrow-up",
  "bell",
  "chevron-small-right",
  "circle",
  "close",
  "close-circle",
  "compass",
  "confirm",
  "construction",
  "heart",
  "home",
  "map-marker",
  "map-marker-radius",
  "moon",
  "my-location",
  "play",
  "rotate-180",
  "security",
  "speed",
  "star",
  "sunny",
  "sunny-loop",
  "watch",
] as const;

export type LineMdIconName = (typeof LINE_MD_ICON_NAMES)[number];

export interface LineMdIconProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  "children" | "color"
> {
  name: LineMdIconName;
  label?: string;
  size?: string | number;
}

interface IconStyle extends CSSProperties {
  "--line-md-icon-size"?: string;
  "--line-md-icon-url"?: string;
}

const LineMdIcon = ({
  name,
  label,
  size,
  className = "",
  style,
  ...props
}: LineMdIconProps) => {
  const iconSize = typeof size === "number" ? `${size}px` : size;
  const baseUrl = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const iconStyle: IconStyle = {
    ...style,
    ...(iconSize ? { "--line-md-icon-size": iconSize } : {}),
    "--line-md-icon-url": `url("${baseUrl}icons/line-md/${name}.svg")`,
  };

  return (
    <span
      {...props}
      className={`line-md-icon ${className}`.trim()}
      data-icon={name}
      style={iconStyle}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
};

export default LineMdIcon;
