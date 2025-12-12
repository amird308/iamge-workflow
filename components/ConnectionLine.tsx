import React from 'react';

interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isTemp?: boolean;
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({ x1, y1, x2, y2, isTemp }) => {
  // Cubic Bezier Curve logic for smooth connectors
  const deltaX = Math.abs(x2 - x1);
  const controlPointOffset = Math.max(deltaX * 0.5, 50);

  const path = `M ${x1} ${y1} C ${x1 + controlPointOffset} ${y1}, ${x2 - controlPointOffset} ${y2}, ${x2} ${y2}`;

  return (
    <g>
        {/* Shadow/Outline for better visibility */}
        <path
            d={path}
            stroke="white"
            strokeWidth="5"
            fill="none"
        />
        {/* Main Line */}
        <path
            d={path}
            stroke={isTemp ? "#6366f1" : "#94a3b8"}
            strokeWidth="2"
            fill="none"
            strokeDasharray={isTemp ? "5,5" : "none"}
            className={isTemp ? "animate-pulse" : ""}
        />
    </g>
  );
};