import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

const toneClassNames = {
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
};

const iconByTone = {
  warning: AlertTriangle,
  danger: ShieldAlert,
};

const LevelEditorValidationBadgeList = ({ messages = [] }) => {
  if (!messages.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {messages.map((message) => {
        const Icon = iconByTone[message.tone] || AlertTriangle;
        return (
          <div
            key={message.id}
            className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm ${toneClassNames[message.tone] || toneClassNames.warning}`}
          >
            <Icon className="mt-0.5 h-4 w-4 flex-none" />
            <span>{message.message}</span>
          </div>
        );
      })}
    </div>
  );
};

export default LevelEditorValidationBadgeList;
