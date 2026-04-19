import React from 'react';

const baseInputClassName = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';

const FieldControl = ({ field, value, onChange, context }) => {
  const options = field.optionsResolver ? field.optionsResolver(context) : [];

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <span className="font-medium">{field.label}</span>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{field.label}</span>
        <textarea
          rows={field.rows || 3}
          value={value ?? ''}
          placeholder={field.placeholder || ''}
          className={`${baseInputClassName} min-h-[96px] resize-y`}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{field.label}</span>
        <select
          value={value ?? ''}
          className={baseInputClassName}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={`${field.key}-${option.value || 'empty'}`} value={option.value ?? ''}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{field.label}</span>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={value ?? ''}
        placeholder={field.placeholder || ''}
        className={baseInputClassName}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
};

export default FieldControl;
