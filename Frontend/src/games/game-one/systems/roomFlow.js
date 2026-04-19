const toGridNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

export const toCellKey = (col, row) => `${toGridNumber(col, 0)}:${toGridNumber(row, 0)}`;

export const getViewport = (levelData) => ({
  width: Number(levelData?.viewport?.width) || 1280,
  height: Number(levelData?.viewport?.height) || 720,
});

export const getCellCount = (levelData) => (
  Array.isArray(levelData?.grid?.cells)
    ? levelData.grid.cells.length
    : (Array.isArray(levelData?.rooms) ? levelData.rooms.length : 0)
);

export const getQuestionById = (levelData, questionId) => (
  levelData?.questions?.find((question) => question.id === questionId) || null
);

export const getCellLayout = (cell, fallbackCol = 0, fallbackRow = 0) => ({
  col: toGridNumber(cell?.col ?? cell?.layout?.col, fallbackCol),
  row: toGridNumber(cell?.row ?? cell?.layout?.row, fallbackRow),
});

export const getCellOrigin = (cell, viewport) => ({
  x: getCellLayout(cell).col * viewport.width,
  y: getCellLayout(cell).row * viewport.height,
});

export const getCellWorldBounds = (cell, viewport) => {
  const layout = getCellLayout(cell);
  const left = layout.col * viewport.width;
  const top = layout.row * viewport.height;

  return {
    left,
    top,
    right: left + viewport.width,
    bottom: top + viewport.height,
    width: viewport.width,
    height: viewport.height,
    centerX: left + (viewport.width / 2),
    centerY: top + (viewport.height / 2),
  };
};

export const buildWorldGridLayout = (levelData) => {
  const viewport = getViewport(levelData);
  const cells = Array.isArray(levelData?.grid?.cells)
    ? levelData.grid.cells
    : (Array.isArray(levelData?.rooms)
      ? levelData.rooms.map((room, index) => ({
          id: room.id || `cell-${index + 1}`,
          col: room?.layout?.col ?? index,
          row: room?.layout?.row ?? 0,
          backgroundKey: room?.backgroundKey,
          objective: room?.objective || '',
          postUnlockObjective: room?.postUnlockObjective || '',
        }))
      : []);
  const records = [];
  const byId = new Map();
  const byCell = new Map();

  let minCol = 0;
  let maxCol = 0;
  let minRow = 0;
  let maxRow = 0;

  cells.forEach((cell, index) => {
    const layout = getCellLayout(cell, index, 0);

    if (index === 0) {
      minCol = layout.col;
      maxCol = layout.col;
      minRow = layout.row;
      maxRow = layout.row;
    } else {
      minCol = Math.min(minCol, layout.col);
      maxCol = Math.max(maxCol, layout.col);
      minRow = Math.min(minRow, layout.row);
      maxRow = Math.max(maxRow, layout.row);
    }

    const record = {
      cell: {
        ...cell,
        col: layout.col,
        row: layout.row,
      },
      index,
      cellId: cell.id,
      roomId: cell.id,
      key: toCellKey(layout.col, layout.row),
      origin: getCellOrigin(layout, viewport),
      bounds: getCellWorldBounds(layout, viewport),
    };

    records.push(record);
    byId.set(record.cellId, record);
    byCell.set(record.key, record);
  });

  const bounds = {
    left: minCol * viewport.width,
    top: minRow * viewport.height,
    right: (maxCol + 1) * viewport.width,
    bottom: (maxRow + 1) * viewport.height,
    width: Math.max(1, (maxCol - minCol) + 1) * viewport.width,
    height: Math.max(1, (maxRow - minRow) + 1) * viewport.height,
    minCol,
    maxCol,
    minRow,
    maxRow,
  };

  return {
    cells: records,
    byId,
    byCell,
    viewport,
    bounds,
  };
};

export const getCellRecordAtWorldPoint = (worldLayout, x, y) => (
  worldLayout?.cells?.find((record) => (
    x >= record.bounds.left
    && x < record.bounds.right
    && y >= record.bounds.top
    && y < record.bounds.bottom
  )) || null
);

export const getAdjacentEmptyCells = (levelData) => {
  const worldLayout = buildWorldGridLayout(levelData);
  const occupied = new Set(worldLayout.cells.map((record) => record.key));
  const candidates = new Map();

  worldLayout.cells.forEach((record) => {
    [
      { col: record.cell.col, row: record.cell.row - 1 },
      { col: record.cell.col + 1, row: record.cell.row },
      { col: record.cell.col, row: record.cell.row + 1 },
      { col: record.cell.col - 1, row: record.cell.row },
    ].forEach((candidate) => {
      const key = toCellKey(candidate.col, candidate.row);
      if (!occupied.has(key) && !candidates.has(key)) {
        candidates.set(key, candidate);
      }
    });
  });

  if (!candidates.size) {
    candidates.set(toCellKey(0, 0), { col: 0, row: 0 });
  }

  return Array.from(candidates.values()).sort((left, right) => (
    left.row - right.row || left.col - right.col
  ));
};

export const toWorldPosition = (originOrRecord, point = {}) => {
  const origin = originOrRecord?.origin || originOrRecord || { x: 0, y: 0 };
  return {
    x: Number(origin.x || 0) + Number(point.x || 0),
    y: Number(origin.y || 0) + Number(point.y || 0),
  };
};

// Backward-compatible aliases during the editor/runtime transition.
export const getRoomCount = getCellCount;
export const getRoomLayoutCell = getCellLayout;
export const buildRoomWorldLayout = buildWorldGridLayout;
export const getRoomRecordAtWorldPoint = getCellRecordAtWorldPoint;

export const areRoomsAdjacent = (worldLayout, fromId, toId) => {
  const fromRecord = worldLayout?.byId?.get(fromId);
  const toRecord = worldLayout?.byId?.get(toId);

  if (!fromRecord || !toRecord) {
    return false;
  }

  const deltaCol = Math.abs(fromRecord.cell.col - toRecord.cell.col);
  const deltaRow = Math.abs(fromRecord.cell.row - toRecord.cell.row);

  return (deltaCol + deltaRow) === 1;
};
