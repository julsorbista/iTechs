import React from 'react';

const SHEET_BOX_SIZE = 44;

const renderSpriteSheetPreview = (preview) => {
  const scale = Math.min(
    1,
    SHEET_BOX_SIZE / Math.max(preview.frameWidth || SHEET_BOX_SIZE, preview.frameHeight || SHEET_BOX_SIZE),
  );

  return (
    <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/70 bg-white shadow-inner">
      <img
        src={preview.sheet?.url}
        alt=""
        className="absolute left-0 top-0 max-w-none select-none"
        style={{
          height: `${(preview.frameHeight || SHEET_BOX_SIZE) * scale}px`,
          width: 'auto',
          imageRendering: 'pixelated',
        }}
        draggable={false}
      />
    </div>
  );
};

const renderImagePreview = (preview) => (
  <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/70 bg-white shadow-inner">
    <img
      src={preview.url}
      alt=""
      className={preview.contain ? 'h-full w-full object-contain p-1' : 'h-full w-full object-cover'}
      draggable={false}
    />
  </div>
);

const renderTilePreview = (preview) => (
  <div
    className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/70 shadow-inner"
    style={{
      backgroundImage: preview.url ? `url(${preview.url})` : 'linear-gradient(135deg, #d1d5db, #94a3b8)',
      backgroundRepeat: 'repeat-x',
      backgroundPosition: 'center',
      backgroundSize: 'auto 100%',
    }}
  />
);

const LevelEditorObjectPreview = ({ preview, fallbackLabel }) => {
  if (!preview || preview.kind === 'fallback') {
    return (
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {fallbackLabel}
      </div>
    );
  }

  if (preview.kind === 'sheet' && preview.sheet?.url) {
    return renderSpriteSheetPreview(preview);
  }

  if (preview.kind === 'tile') {
    return renderTilePreview(preview);
  }

  if (preview.kind === 'image' && preview.url) {
    return renderImagePreview(preview);
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
      {fallbackLabel}
    </div>
  );
};

export default LevelEditorObjectPreview;
