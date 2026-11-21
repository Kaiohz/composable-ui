import * as React from "react";
import { cn } from "@/application/lib/utils";
import { badgeVariants, type BadgeVariantProps } from "@/application/components/ui/badge-variants";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, BadgeVariantProps {}

function Badge({ className, variant, ...props }: Readonly<BadgeProps>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
