import React from 'react';
import clsx from 'clsx';

const IconTile = ({ icon, title, description, className, ...props }) => {
  return (
    <button className={clsx('pixel-tile w-full', className)} {...props}>
      <span className="text-3xl" aria-hidden="true">{icon}</span>
      <span className="font-black text-slate-900">{title}</span>
      {description ? <span className="text-sm text-slate-600">{description}</span> : null}
    </button>
  );
};

export default IconTile;
