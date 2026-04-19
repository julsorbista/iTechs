import React from 'react';

const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeMap = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  };

  return (
    <div className={`state-box ${className}`}>
      <div className="flex flex-col items-center gap-3">
        <div className={`animate-spin rounded-full border-4 border-teal-700 border-t-transparent ${sizeMap[size] || sizeMap.md}`}></div>
        <p className="text-sm font-semibold text-slate-600">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;