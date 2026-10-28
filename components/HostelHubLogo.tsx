'use client';

import React from 'react';
import { StayKoshLogo } from './StayKoshLogo';

interface HostelHubLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  href?: string;
  className?: string;
  showTagline?: boolean;
}

/**
 * Backward-compatibility wrapper pointing to the official StayKosh logo component.
 */
export function HostelHubLogo({
  size = 'md',
  variant = 'dark',
  href = '/',
  className = '',
}: HostelHubLogoProps) {
  const pixelSize = size === 'sm' ? 32 : size === 'lg' ? 44 : 36;
  const theme = variant === 'light' ? 'dark' : 'light';

  return (
    <StayKoshLogo
      size={pixelSize}
      theme={theme}
      href={href}
      className={className}
      showWordmark={true}
    />
  );
}

export { StayKoshLogo };
export default HostelHubLogo;
