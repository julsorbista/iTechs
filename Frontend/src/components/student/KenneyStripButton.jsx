import React from 'react';
import { kenneyPixelAdventureUi } from '../../assets/ui/kenney/pixelAdventureUi';

const STRIP_VARIANTS = Object.freeze({
  coral: kenneyPixelAdventureUi.strips.coral,
  coralAlt: kenneyPixelAdventureUi.strips.coralAlt,
  slate: kenneyPixelAdventureUi.strips.slate,
  slateAlt: kenneyPixelAdventureUi.strips.slateAlt,
});

const KenneyStripButton = ({
  children,
  variant = 'coral',
  className = '',
  contentClassName = '',
  disabled = false,
  type = 'button',
  ...props
}) => {
  const strip = STRIP_VARIANTS[variant] || STRIP_VARIANTS.coral;

  return (
    <button
      type={type}
      className={`kenney-strip-button ${disabled ? 'kenney-strip-button-disabled' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      <span
        aria-hidden="true"
        className="kenney-strip-slice kenney-strip-slice-left"
        style={{ backgroundImage: `url(${strip.left})` }}
      />
      <span
        aria-hidden="true"
        className="kenney-strip-slice kenney-strip-slice-center"
        style={{ backgroundImage: `url(${strip.center})` }}
      />
      <span
        aria-hidden="true"
        className="kenney-strip-slice kenney-strip-slice-right"
        style={{ backgroundImage: `url(${strip.right})` }}
      />
      <span className={`kenney-strip-content ${contentClassName}`}>
        {children}
      </span>
    </button>
  );
};

export default KenneyStripButton;
