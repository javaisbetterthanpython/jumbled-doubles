import React from "react";
import clsx from "clsx";

export function PlayerBadge({
  color,
  children,
  onPress,
}: {
  children: React.ReactNode;
  color: "primary" | "secondary" | "default";
  onPress?: () => void;
}) {
  const className = clsx(
    "border-2 font-semibold text-lg sm:text-medium",
    `text-${color} border-${color} rounded-lg px-2 py-1`,
    {
      "bg-slate-100": color === "default",
      "border-slate-400": color === "default",
      "text-slate-800": color === "default",
    }
  );
  if (onPress) {
    return (
      <button
        type="button"
        className={clsx(
          className,
          "cursor-pointer underline decoration-dotted underline-offset-4"
        )}
        title="Tap to rename"
        onClick={onPress}
      >
        {children}
      </button>
    );
  }
  return <p className={className}>{children}</p>;
}
