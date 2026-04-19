import React from 'react';
import clsx from 'clsx';

const PixelButton = ({
  children,
  variant = 'primary',
  className,
  ...props
}) => {
  const variantClass = {
    primary: 'btn btn-primary',
    secondary: 'btn btn-secondary',
    success: 'btn btn-success',
    danger: 'btn btn-danger',
  }[variant] || 'btn btn-secondary';

  return (
    <button className={clsx(variantClass, className)} {...props}>
      {children}
    </button>
  );
};

export default PixelButton;
