import React from 'react';
import Group1 from "../../imports/Group1";

interface LogoProps {
  className?: string;
  color?: string;
}

export const Logo = ({ 
  className = "size-8",
  color = "#074738"
}: LogoProps) => (
  <div 
    className={className} 
    style={{ 
      '--fill-0': color
    } as React.CSSProperties}
  >
    <Group1 />
  </div>
);