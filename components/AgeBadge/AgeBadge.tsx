'use client';

import React from 'react';

export default function AgeBadge({ rating }: { rating: string | null }) {
  if (!rating) return null;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '4px',
        lineHeight: '1.6',
        verticalAlign: 'middle',
      }}
    >
      {rating}
    </span>
  );
}
