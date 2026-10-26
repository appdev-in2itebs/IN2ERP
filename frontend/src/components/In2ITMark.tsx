import React from 'react';

interface In2ITMarkProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const In2ITMark: React.FC<In2ITMarkProps> = ({
  size = 32,
  color = '#121E3B',
  className = '',
  style = {},
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-label="In2IT EBS mark"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <g fill={color}>
        {/* TL shard */}
        <polygon points="0,0 50,0 50,50" />
        {/* TR shard */}
        <polygon points="50,0 100,0 100,50" />
        {/* BL shard */}
        <polygon points="0,50 50,50 50,100" />
        {/* BR shard */}
        <polygon points="50,50 100,50 100,100" />
      </g>
    </svg>
  );
};
