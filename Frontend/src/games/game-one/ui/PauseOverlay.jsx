import React from 'react';

const PauseOverlay = ({ isOpen, onResume, onExit }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-20">
      <div className="w-full max-w-md card text-center space-y-5">
        <div>
          <p className="hero-kicker !text-emerald-700">Session Pause</p>
          <h2 className="text-3xl font-black text-gray-900 mt-2">Paused</h2>
        </div>
        <p className="text-sm leading-6 text-gray-600">
          Take a breather, then jump back into the tutorial when you are ready.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button type="button" className="btn btn-primary" onClick={onResume}>
            Resume
          </button>
          <button type="button" className="btn btn-secondary" onClick={onExit}>
            Exit Level
          </button>
        </div>
      </div>
    </div>
  );
};

export default PauseOverlay;
