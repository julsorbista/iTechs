import React from 'react';
import LoadingSpinner from '../LoadingSpinner';

export const EmptyState = ({ title = 'Nothing here yet', message = 'No data to display.' }) => (
  <div className="state-box">
    <h3 className="text-lg font-black text-slate-800">{title}</h3>
    <p className="mt-1 text-sm text-slate-600">{message}</p>
  </div>
);

export const ErrorState = ({ title = 'Something went wrong', message = 'Please try again.' }) => (
  <div className="state-box border-2 border-rose-500">
    <h3 className="text-lg font-black text-rose-800">{title}</h3>
    <p className="mt-1 text-sm text-rose-700">{message}</p>
  </div>
);

export const LoadingState = ({ message = 'Loading interface...' }) => (
  <div className="state-box">
    <LoadingSpinner size="sm" />
    <p className="mt-2 text-sm font-semibold text-slate-600">{message}</p>
  </div>
);
