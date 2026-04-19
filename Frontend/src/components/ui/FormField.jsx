import React from 'react';
import clsx from 'clsx';

const FormField = ({
  id,
  label,
  error,
  className,
  ...props
}) => {
  return (
    <div className={clsx('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-bold text-slate-800">
          {label}
        </label>
      ) : null}
      <input id={id} className="input-field" {...props} />
      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
};

export default FormField;
