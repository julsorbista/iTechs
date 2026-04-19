import React from 'react';
import PixelButton from './PixelButton';

const PixelModal = ({
  open,
  title,
  children,
  onClose,
  closeLabel = 'Close',
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="pixel-panel w-full max-w-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="pixel-title text-xl">{title}</h3>
          <PixelButton variant="secondary" onClick={onClose}>{closeLabel}</PixelButton>
        </div>
        {children}
      </div>
    </div>
  );
};

export default PixelModal;
