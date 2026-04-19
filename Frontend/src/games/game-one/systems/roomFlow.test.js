import { describe, expect, it } from 'vitest';

import {
  areRoomsAdjacent,
  buildRoomWorldLayout,
  getRoomLayoutCell,
  getRoomRecordAtWorldPoint,
  toWorldPosition,
} from './roomFlow';

describe('roomFlow world layout helpers', () => {
  it('normalizes room layout cells from saved layout values', () => {
    expect(getRoomLayoutCell({ layout: { col: '2', row: '-1' } }, 0, 0)).toEqual({
      col: 2,
      row: -1,
    });
  });

  it('builds contiguous world bounds from room layout cells', () => {
    const layout = buildRoomWorldLayout({
      viewport: { width: 1280, height: 720 },
      rooms: [
        { id: 'room-1', layout: { col: 0, row: 0 } },
        { id: 'room-2', layout: { col: 1, row: 0 } },
        { id: 'room-3', layout: { col: 1, row: 1 } },
      ],
    });

    expect(layout.bounds.width).toBe(2560);
    expect(layout.bounds.height).toBe(1440);
    expect(layout.byId.get('room-2').origin).toEqual({ x: 1280, y: 0 });
    expect(toWorldPosition(layout.byId.get('room-3'), { x: 50, y: 60 })).toEqual({ x: 1330, y: 780 });
  });

  it('resolves player position to the correct area and adjacency', () => {
    const layout = buildRoomWorldLayout({
      viewport: { width: 100, height: 80 },
      rooms: [
        { id: 'a', layout: { col: 0, row: 0 } },
        { id: 'b', layout: { col: 1, row: 0 } },
        { id: 'c', layout: { col: 1, row: 1 } },
      ],
    });

    expect(getRoomRecordAtWorldPoint(layout, 150, 40)?.roomId).toBe('b');
    expect(areRoomsAdjacent(layout, 'a', 'b')).toBe(true);
    expect(areRoomsAdjacent(layout, 'a', 'c')).toBe(false);
  });
});
