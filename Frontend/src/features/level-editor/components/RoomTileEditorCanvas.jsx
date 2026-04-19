import React, { useCallback, useMemo, useRef, useState } from 'react';

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 720;
const MAX_TILE_SIZE = 1024;
const MIN_ROTATION_DEG = 0;
const MAX_ROTATION_DEG = 359;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeRotationDeg = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return clamp(fallback, MIN_ROTATION_DEG, MAX_ROTATION_DEG);
  }

  const rounded = Math.round(parsed);
  const normalized = ((rounded % 360) + 360) % 360;
  return clamp(normalized, MIN_ROTATION_DEG, MAX_ROTATION_DEG);
};

const toWorldPoint = (event, stageElement) => {
  const bounds = stageElement.getBoundingClientRect();
  if (!bounds.width || !bounds.height) {
    return { x: 0, y: 0 };
  }

  return {
    x: ((event.clientX - bounds.left) / bounds.width) * VIEWPORT_WIDTH,
    y: ((event.clientY - bounds.top) / bounds.height) * VIEWPORT_HEIGHT,
  };
};

const RoomTileEditorCanvas = ({
  className = '',
  backgroundImageUrl = '',
  backgroundColor = '#111827',
  tiles = [],
  activeTile = null,
  selectedTileId = '',
  tileSize = 96,
  snapSize = 32,
  toolMode = 'select',
  eraseMode = false,
  previewRotationDeg = 0,
  previewFlipX = false,
  previewFlipY = false,
  onCanvasAction,
  onTileSelect,
  onTileMove,
}) => {
  const stageRef = useRef(null);
  const lastDragActionRef = useRef('');
  const dragStateRef = useRef(null);
  const lastMoveActionRef = useRef('');
  const [hoverPoint, setHoverPoint] = useState(null);

  const safeSnapSize = useMemo(() => {
    const parsed = Number(snapSize);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return clamp(parsed, 8, 320);
  }, [snapSize]);
  const safeTileSize = useMemo(() => clamp(Number(tileSize) || 96, 16, MAX_TILE_SIZE), [tileSize]);

  const isSelectMode = toolMode === 'select';

  const getSnappedPoint = useCallback((point) => {
    if (safeSnapSize <= 0) {
      return {
        x: clamp(Math.round(point.x), 0, VIEWPORT_WIDTH),
        y: clamp(Math.round(point.y), 0, VIEWPORT_HEIGHT),
      };
    }

    return {
      x: clamp(Math.round((Math.floor(point.x / safeSnapSize) * safeSnapSize) + (safeSnapSize * 0.5)), 0, VIEWPORT_WIDTH),
      y: clamp(Math.round((Math.floor(point.y / safeSnapSize) * safeSnapSize) + (safeSnapSize * 0.5)), 0, VIEWPORT_HEIGHT),
    };
  }, [safeSnapSize]);

  const gridLinePositions = useMemo(() => {
    if (safeSnapSize <= 0) {
      return {
        vertical: [],
        horizontal: [],
      };
    }

    const vertical = [];
    for (let x = 0; x <= VIEWPORT_WIDTH; x += safeSnapSize) {
      vertical.push(x);
    }
    if (vertical[vertical.length - 1] !== VIEWPORT_WIDTH) {
      vertical.push(VIEWPORT_WIDTH);
    }

    const horizontal = [];
    for (let y = 0; y <= VIEWPORT_HEIGHT; y += safeSnapSize) {
      horizontal.push(y);
    }
    if (horizontal[horizontal.length - 1] !== VIEWPORT_HEIGHT) {
      horizontal.push(VIEWPORT_HEIGHT);
    }

    return {
      vertical,
      horizontal,
    };
  }, [safeSnapSize]);

  const findTileAtPoint = useCallback((point) => {
    for (let index = tiles.length - 1; index >= 0; index -= 1) {
      const tile = tiles[index];
      const tileX = Number(tile.x || 0);
      const tileY = Number(tile.y || 0);
      const size = clamp(Number(tile.size || safeTileSize), 16, MAX_TILE_SIZE);
      const half = size * 0.5;

      if (
        point.x >= tileX - half
        && point.x <= tileX + half
        && point.y >= tileY - half
        && point.y <= tileY + half
      ) {
        return tile;
      }
    }

    return null;
  }, [safeTileSize, tiles]);

  const handlePointerMove = (event) => {
    if (!stageRef.current) {
      return;
    }

    const worldPoint = toWorldPoint(event, stageRef.current);
    const snappedPoint = getSnappedPoint(worldPoint);
    setHoverPoint(snappedPoint);

    const dragState = dragStateRef.current;
    if (dragState && isSelectMode) {
      const nextPoint = getSnappedPoint({
        x: worldPoint.x - dragState.offsetX,
        y: worldPoint.y - dragState.offsetY,
      });

      const moveKey = `${dragState.tileId}:${nextPoint.x}:${nextPoint.y}`;
      if (moveKey === lastMoveActionRef.current) {
        return;
      }

      lastMoveActionRef.current = moveKey;
      onTileMove?.({
        id: dragState.tileId,
        point: nextPoint,
      });
      return;
    }

    const isDragGesture = Boolean(event.buttons & 1) || Boolean(event.buttons & 2);
    const supportsDragPaint = toolMode === 'paint' || toolMode === 'erase';
    const hasPaintSource = toolMode === 'erase' || eraseMode || Boolean(activeTile?.url);
    if (!isDragGesture || !supportsDragPaint || !hasPaintSource) {
      return;
    }

    const shouldErase = eraseMode || toolMode === 'erase' || Boolean(event.buttons & 2) || event.altKey;
    const actionKey = `${snappedPoint.x}:${snappedPoint.y}:${shouldErase ? 'erase' : 'paint'}`;
    if (lastDragActionRef.current === actionKey) {
      return;
    }

    lastDragActionRef.current = actionKey;
    onCanvasAction?.({
      point: snappedPoint,
      erase: shouldErase,
    });
  };

  const handlePointerLeave = () => {
    setHoverPoint(null);
    lastDragActionRef.current = '';
    dragStateRef.current = null;
    lastMoveActionRef.current = '';
  };

  const handlePointerUp = () => {
    lastDragActionRef.current = '';
    dragStateRef.current = null;
    lastMoveActionRef.current = '';
  };

  const handlePointerCancel = () => {
    lastDragActionRef.current = '';
    dragStateRef.current = null;
    lastMoveActionRef.current = '';
  };

  const handlePointerDown = (event) => {
    if (!stageRef.current) {
      return;
    }

    event.preventDefault();

    const worldPoint = toWorldPoint(event, stageRef.current);
    const snappedPoint = getSnappedPoint(worldPoint);

    if (isSelectMode) {
      const hitTile = findTileAtPoint(worldPoint);
      if (hitTile) {
        onTileSelect?.(hitTile.id);

        if (event.button === 0) {
          dragStateRef.current = {
            tileId: hitTile.id,
            offsetX: worldPoint.x - Number(hitTile.x || 0),
            offsetY: worldPoint.y - Number(hitTile.y || 0),
          };
        }
        return;
      }

      onTileSelect?.('');
      if (!activeTile?.url) {
        return;
      }
    }

    const shouldErase = eraseMode || event.button === 2 || event.altKey;
    if (event.button !== 0 && !shouldErase) {
      return;
    }

    lastDragActionRef.current = `${snappedPoint.x}:${snappedPoint.y}:${shouldErase ? 'erase' : 'paint'}`;

    onCanvasAction?.({
      point: snappedPoint,
      erase: shouldErase,
    });
  };

  return (
    <div
      ref={stageRef}
      onContextMenu={(event) => event.preventDefault()}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      className={`relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 shadow-inner ${className}`}
      style={{ aspectRatio: `${VIEWPORT_WIDTH} / ${VIEWPORT_HEIGHT}` }}
    >
      <div className="absolute inset-0" style={{ backgroundColor }} />

      {backgroundImageUrl ? (
        <img
          src={backgroundImageUrl}
          alt="Room background"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : null}

      {backgroundImageUrl ? <div className="absolute inset-0 bg-slate-900/30" /> : null}

      {safeSnapSize > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${VIEWPORT_WIDTH} ${VIEWPORT_HEIGHT}`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
        >
          {gridLinePositions.vertical.map((x) => (
            <line
              key={`grid-x-${x}`}
              x1={x}
              y1={0}
              x2={x}
              y2={VIEWPORT_HEIGHT}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {gridLinePositions.horizontal.map((y) => (
            <line
              key={`grid-y-${y}`}
              x1={0}
              y1={y}
              x2={VIEWPORT_WIDTH}
              y2={y}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}

      {tiles.map((tile) => (
        (() => {
          const rotationDeg = normalizeRotationDeg(tile.rotationDeg, 0);
          const scaleX = tile.flipX ? -1 : 1;
          const scaleY = tile.flipY ? -1 : 1;

          return (
            <img
              key={tile.id}
              src={tile.url}
              alt={tile.label || 'Tile'}
              draggable={false}
              className="pointer-events-none absolute"
              style={{
                left: `${(Number(tile.x || 0) / VIEWPORT_WIDTH) * 100}%`,
                top: `${(Number(tile.y || 0) / VIEWPORT_HEIGHT) * 100}%`,
                width: `${(Number(tile.size || safeTileSize) / VIEWPORT_WIDTH) * 100}%`,
                transform: `translate(-50%, -50%) rotate(${rotationDeg}deg) scale(${scaleX}, ${scaleY})`,
                imageRendering: 'pixelated',
                mixBlendMode: tile.blendMode === 'screen' ? 'screen' : 'normal',
                filter: selectedTileId === tile.id
                  ? 'drop-shadow(0 0 0.45rem rgba(34, 211, 238, 0.95)) drop-shadow(0 2px 0 rgba(2, 6, 23, 0.75))'
                  : 'drop-shadow(0 2px 0 rgba(2, 6, 23, 0.75))',
              }}
            />
          );
        })()
      ))}

      {toolMode !== 'erase' && !eraseMode && activeTile?.url && hoverPoint && (
        <img
          src={activeTile.url}
          alt="Tile preview"
          draggable={false}
          className="pointer-events-none absolute opacity-65"
          style={{
            left: `${(hoverPoint.x / VIEWPORT_WIDTH) * 100}%`,
            top: `${(hoverPoint.y / VIEWPORT_HEIGHT) * 100}%`,
            width: `${(safeTileSize / VIEWPORT_WIDTH) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${normalizeRotationDeg(previewRotationDeg, 0)}deg) scale(${previewFlipX ? -1 : 1}, ${previewFlipY ? -1 : 1})`,
            imageRendering: 'pixelated',
            mixBlendMode: activeTile?.blendMode === 'screen' ? 'screen' : 'normal',
          }}
        />
      )}
    </div>
  );
};

export default RoomTileEditorCanvas;
