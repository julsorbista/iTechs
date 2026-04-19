import React from 'react';
import { Coins, Star } from 'lucide-react';
import { getResultHeadline } from '../systems/progressBridge';

const ResultOverlay = ({ result, gameplay, isSubmitting, onRetry, onBack }) => {
  if (!result && !isSubmitting) {
    return null;
  }

  const headline = getResultHeadline(result);
  const stars = Number(result?.starsEarned || 0);
  const isFailure = result?.result === 'FAILED';

  return (
    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-30">
      <div className="w-full max-w-lg card text-center space-y-5">
        <div>
          <p className="hero-kicker !text-emerald-700">Game 1 Result</p>
          <h2 className="text-3xl font-black text-gray-900 mt-2">{isSubmitting ? 'Saving Result...' : headline}</h2>
          <p className="text-sm leading-6 text-gray-600 mt-2">
            {isSubmitting
              ? 'Updating your session progress and stars.'
              : result?.result === 'COMPLETED'
                ? 'The stage is cleared.'
                : 'The run ended before the stage was cleared. Retry the level to continue.'}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3 text-left">
          <div className="summary-tile-light">
            <p className="text-xs text-gray-500 uppercase">Stars</p>
            <p className="text-2xl font-black text-amber-600 flex items-center gap-2">
              <Star className="w-5 h-5 fill-current" />
              {stars}
            </p>
          </div>
          <div className="summary-tile-light">
            <p className="text-xs text-gray-500 uppercase">Score</p>
            <p className="text-2xl font-black text-gray-900">{result?.finalScore ?? '--'}</p>
          </div>
          <div className="summary-tile-light">
            <p className="text-xs text-gray-500 uppercase">Coins</p>
            <p className="text-2xl font-black text-emerald-700 flex items-center gap-2">
              <Coins className="w-5 h-5" />
              {gameplay?.coinsCollected ?? 0}/{gameplay?.totalCoins ?? 0}
            </p>
          </div>
        </div>

        {!isSubmitting && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" className="btn btn-primary" onClick={onRetry}>
              {isFailure ? 'Retry Level' : 'Play Again'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Back To Levels
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultOverlay;
