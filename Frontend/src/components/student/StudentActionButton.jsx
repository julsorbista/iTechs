import React from 'react';
import clsx from 'clsx';

const StudentActionButton = ({
  children,
  variant = 'sand',
  size = 'default',
  className = '',
  contentClassName = '',
  disabled = false,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    disabled={disabled}
    className={clsx(
      'student-action-button',
      `student-action-button-${variant}`,
      size === 'compact' && 'student-action-button-compact',
      disabled && 'student-action-button-disabled',
      className,
    )}
    {...props}
  >
    <span className={clsx('student-action-button-inner', contentClassName)}>
      {children}
    </span>
  </button>
);

export default StudentActionButton;
