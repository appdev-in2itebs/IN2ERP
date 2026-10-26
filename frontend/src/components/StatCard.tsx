import React from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  bg?: string;
  color?: string;
  accent?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  bg = 'rgba(99, 102, 241, 0.12)',
  color = '#6366f1',
  accent,
}) => {
  return (
    <div
      className="stat-card"
      style={{ '--stat-accent': accent } as React.CSSProperties}
    >
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
      <div className="stat-icon" style={{ background: bg, color }}>
        {icon}
      </div>
    </div>
  );
};
