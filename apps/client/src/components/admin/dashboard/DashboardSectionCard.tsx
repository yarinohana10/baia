import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

type DashboardSectionCardProps = {
  icon: LucideIcon;
  title: string;
  /** Icon colour; ocean by default. */
  iconClassName?: string;
  children: ReactNode;
};

/** Dashboard card with an icon + title header. */
export function DashboardSectionCard({
  icon: Icon,
  title,
  iconClassName = 'text-ocean-700',
  children,
}: DashboardSectionCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon size={18} className={iconClassName} />
          <CardTitle className="font-serif text-xl">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
