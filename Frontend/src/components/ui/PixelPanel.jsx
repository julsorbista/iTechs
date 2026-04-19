import React from 'react';
import clsx from 'clsx';

const PixelPanel = ({ title, subtitle, children, className }) => {
  return (
    <section className={clsx('pixel-panel', className)}>
      {(title || subtitle) && (
        <header className="mb-4">
          {title && <h2 className="pixel-title">{title}</h2>}
          {subtitle && <p className="pixel-subtitle mt-1">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
};

export default PixelPanel;
