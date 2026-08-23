import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

function Hello() {
  return <div>hello world</div>;
}

describe('rtl sanity', () => {
  it('renders', () => {
    render(<Hello />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });
});
