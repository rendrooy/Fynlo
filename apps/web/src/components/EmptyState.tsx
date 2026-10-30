import type { LucideIcon } from "lucide-react";

export function EmptyState({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="empty">
      <div>
        <Icon aria-hidden="true" size={20} />
      </div>
      <b>{title}</b>
      <span>{description}</span>
    </div>
  );
}
