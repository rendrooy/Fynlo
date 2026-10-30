import type { ReactNode } from "react";

export function CardHeader({
  action,
  subtitle,
  title,
}: {
  action?: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="card-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
