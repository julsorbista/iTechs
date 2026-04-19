import Phaser from 'phaser';
import Player from '../entities/Player';
import Coin from '../entities/Coin';
import Portal from '../entities/Portal';
import GhostMinion from '../entities/GhostMinion';
import VillainTrigger from '../entities/VillainTrigger';
import ProjectileCaster from '../entities/ProjectileCaster';
import { freezeAnimatedObject } from '../systems/animations';
import { getGameOneSurfaceMetrics } from '../systems/rendering';
import { buildWorldGridLayout, getAdjacentEmptyCells, getCellWorldBounds } from '../systems/roomFlow';
import { collectWorldObjects } from '../../../features/level-editor/levelEditorUtils';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const ADD_CELL_ZOOM_THRESHOLD = 0.72;
const HANDLE_RADIUS = 10;

const clampZoom = (zoom) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
const isRectEntry = (entry) => entry?.definition?.shape === 'rect';
const destroyAll = (items = []) => items.filter(Boolean).forEach((item) => item.destroy?.());
const rectFromBounds = (left, top, width, height) => new Phaser.Geom.Rectangle(left, top, width, height);

const combineBounds = (objects = []) => {
  const bounds = objects.filter(Boolean).filter((item) => item.visible !== false && item.getBounds).map((item) => item.getBounds());
  if (!bounds.length) {
    return rectFromBounds(0, 0, 0, 0);
  }
  return bounds.slice(1).reduce((combined, current) => Phaser.Geom.Rectangle.Union(combined, current), bounds[0]);
};

const isPanGesture = (pointer, keySpace) => Boolean(keySpace?.isDown) || pointer.middleButtonDown() || pointer.rightButtonDown();

export default class EditorScene extends Phaser.Scene {
  constructor() {
    super('GameOneEditorScene');
  }

  create() {
    this.input.mouse.disableContextMenu();
    this.callbacks = {};
    this.editorState = null;
    this.manifest = null;
    this.worldLayout = null;
    this.objectRecords = new Map();
    this.sceneObjects = [];
    this.handleObjects = [];
    this.dragState = null;
    this.pendingPayload = null;
    this.gridGraphics = this.add.graphics().setDepth(20);
    this.selectionGraphics = this.add.graphics().setDepth(28);
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.handleWindowBlur = () => this.cancelDragState();

    this.input.on('wheel', this.handleWheel, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);
    this.input.on('pointercancel', this.handlePointerUp, this);
    this.game.events.on('blur', this.handleWindowBlur);
    this.game.events.on('hidden', this.handleWindowBlur);
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this.handleWindowBlur);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('wheel', this.handleWheel, this);
      this.input.off('pointermove', this.handlePointerMove, this);
      this.input.off('pointerup', this.handlePointerUp, this);
      this.input.off('pointerupoutside', this.handlePointerUp, this);
      this.input.off('pointercancel', this.handlePointerUp, this);
      this.game.events.off('blur', this.handleWindowBlur);
      this.game.events.off('hidden', this.handleWindowBlur);
      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', this.handleWindowBlur);
      }
      destroyAll(this.sceneObjects);
      destroyAll(this.handleObjects);
    });

    this.applyEditorState(this.game.__ITECHS_EDITOR__, { resetCamera: true });
  }

  cancelDragState() {
    this.dragState = null;
    if (this.pendingPayload) {
      const nextPayload = this.pendingPayload;
      this.pendingPayload = null;
      this.applyEditorState(nextPayload);
    }
  }

  applyEditorState(payload = this.game.__ITECHS_EDITOR__, { resetCamera = false } = {}) {
    if (!payload) {
      return;
    }
    if (this.dragState) {
      this.pendingPayload = payload;
      return;
    }

    this.callbacks = payload.callbacks || this.callbacks || {};
    this.manifest = payload.runtimeAssets?.manifest || this.manifest;
    this.editorState = {
      levelData: payload.levelData,
      selectedCellId: payload.selectedCellId,
      selectedObjectIds: payload.selectedObjectIds || [],
      settings: payload.settings || {},
    };
    if (!this.editorState.levelData || !this.manifest) {
      return;
    }

    this.worldLayout = buildWorldGridLayout(this.editorState.levelData);
    const { left, top, width, height } = this.worldLayout.bounds;
    this.physics.world.setBounds(left, top, width, height);
    this.cameras.main.setBounds(left, top, width, height);

    if (resetCamera) {
      this.worldLayout.cells.length > 1 ? this.fitToWorld() : this.fitToCell();
    }

    this.renderWorld();
    this.emitCameraChange();
  }

  getSelectedCellRecord() {
    return this.worldLayout?.byId?.get(this.editorState?.selectedCellId) || this.worldLayout?.cells?.[0] || null;
  }

  isCameraNavigationEnabled() {
    return this.editorState?.settings?.allowCameraNavigation !== false;
  }

  clampCameraToWorld() {
    const camera = this.cameras.main;
    const bounds = this.worldLayout?.bounds;
    if (!bounds) {
      return;
    }
    const maxScrollX = bounds.right - (camera.width / camera.zoom);
    const maxScrollY = bounds.bottom - (camera.height / camera.zoom);
    camera.scrollX = Phaser.Math.Clamp(camera.scrollX, bounds.left, maxScrollX);
    camera.scrollY = Phaser.Math.Clamp(camera.scrollY, bounds.top, maxScrollY);
  }

  fitToWorld() {
    const camera = this.cameras.main;
    const bounds = this.worldLayout?.bounds;
    if (!bounds) {
      return;
    }
    camera.setZoom(clampZoom(Math.min((camera.width * 0.94) / bounds.width, (camera.height * 0.94) / bounds.height)));
    camera.centerOn(bounds.left + (bounds.width / 2), bounds.top + (bounds.height / 2));
    this.clampCameraToWorld();
    this.renderOverlay();
    this.emitCameraChange();
  }

  fitToCell() {
    const camera = this.cameras.main;
    const bounds = this.getSelectedCellRecord()?.bounds;
    if (!bounds) {
      this.fitToWorld();
      return;
    }
    camera.setZoom(clampZoom(Math.min((camera.width * 0.96) / bounds.width, (camera.height * 0.96) / bounds.height)));
    camera.centerOn(bounds.centerX, bounds.centerY);
    this.clampCameraToWorld();
    this.renderOverlay();
    this.emitCameraChange();
  }

  fitToSelection() {
    const selected = (this.editorState?.selectedObjectIds || []).map((id) => this.objectRecords.get(id)).filter(Boolean);
    if (!selected.length) {
      this.fitToCell();
      return;
    }
    const camera = this.cameras.main;
    const bounds = selected.map((record) => record.getVisualBounds()).reduce((combined, current) => Phaser.Geom.Rectangle.Union(combined, current));
    camera.setZoom(clampZoom(Math.min(camera.width / Math.max(120, bounds.width + 120), camera.height / Math.max(120, bounds.height + 120))));
    camera.centerOn(bounds.centerX, bounds.centerY);
    this.clampCameraToWorld();
    this.renderOverlay();
    this.emitCameraChange();
  }

  zoomIn() {
    this.setZoom(this.cameras.main.zoom + 0.15);
  }

  zoomOut() {
    this.setZoom(this.cameras.main.zoom - 0.15);
  }

  setZoom(nextZoom, pivotX = this.scale.width / 2, pivotY = this.scale.height / 2) {
    const camera = this.cameras.main;
    const before = camera.getWorldPoint(pivotX, pivotY);
    camera.setZoom(clampZoom(nextZoom));
    const after = camera.getWorldPoint(pivotX, pivotY);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
    this.clampCameraToWorld();
    this.renderOverlay();
    this.emitCameraChange();
  }

  emitCameraChange() {
    const camera = this.cameras.main;
    const bounds = this.worldLayout?.bounds;
    const cameraNavigationEnabled = this.isCameraNavigationEnabled();
    const canPan = cameraNavigationEnabled && bounds
      ? ((camera.width / camera.zoom) < bounds.width || (camera.height / camera.zoom) < bounds.height)
      : false;
    this.sceneObjects
      .filter((item) => item?.__isAddCellAffordance)
      .forEach((item) => item.setVisible(cameraNavigationEnabled && camera.zoom <= ADD_CELL_ZOOM_THRESHOLD));
    this.callbacks.onCameraChange?.({ zoom: camera.zoom, canPan, scrollX: camera.scrollX, scrollY: camera.scrollY });
  }

  startPanDrag(pointer) {
    if (!this.isCameraNavigationEnabled()) {
      return;
    }

    if (!(pointer.leftButtonDown() || pointer.middleButtonDown() || pointer.rightButtonDown())) {
      return;
    }
    this.dragState = { mode: 'pan', origin: { x: pointer.x, y: pointer.y }, scroll: { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY } };
  }

  toWorldPoint(clientX, clientY) {
    const bounds = this.game.canvas.getBoundingClientRect();
    const x = ((clientX - bounds.left) / bounds.width) * this.scale.width;
    const y = ((clientY - bounds.top) / bounds.height) * this.scale.height;
    return this.cameras.main.getWorldPoint(x, y);
  }

  renderWorld() {
    destroyAll(this.sceneObjects);
    destroyAll(this.handleObjects);
    this.sceneObjects = [];
    this.handleObjects = [];
    this.objectRecords.clear();
    this.gridGraphics.clear();
    this.selectionGraphics.clear();

    this.worldLayout.cells.forEach((record) => this.createCell(record));
    collectWorldObjects(this.editorState.levelData).forEach((entry) => {
      const record = this.createRecord(entry);
      if (record) {
        this.objectRecords.set(entry.editorId, record);
      }
    });

    getAdjacentEmptyCells(this.editorState.levelData).forEach((candidate) => this.createAddCellAffordance(candidate));
    this.renderOverlay();
  }

  createCell(cellRecord) {
    const { bounds, cell } = cellRecord;
    const backgroundKey = this.manifest.backgrounds?.[cell.backgroundKey]?.key;
    if (backgroundKey && this.textures.exists(backgroundKey)) {
      this.sceneObjects.push(this.add.image(bounds.centerX, bounds.centerY, backgroundKey).setDisplaySize(bounds.width, bounds.height).setDepth(-15));
    }
    this.sceneObjects.push(this.add.rectangle(bounds.centerX, bounds.centerY, bounds.width, bounds.height, 0x0f172a, backgroundKey ? 0.08 : 0.3).setStrokeStyle(3, 0xffffff, 0.18).setDepth(-14));
    const zone = this.add.zone(bounds.centerX, bounds.centerY, bounds.width, bounds.height).setInteractive().setDepth(-13);
    zone.on('pointerdown', (pointer) => this.handleCellPointerDown(pointer, cellRecord));
    this.sceneObjects.push(zone);
    this.sceneObjects.push(this.add.text(bounds.left + 16, bounds.top + 16, `${cell.id}\n${cell.col}, ${cell.row}`, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#f8fafc',
      lineSpacing: 3,
      backgroundColor: 'rgba(15, 23, 42, 0.72)',
      padding: { left: 6, right: 6, top: 4, bottom: 4 },
    }).setDepth(-12.5));
  }

  createAddCellAffordance(candidate) {
    const bounds = getCellWorldBounds(candidate, this.worldLayout.viewport);
    const panel = this.add.rectangle(bounds.centerX, bounds.centerY, bounds.width - 24, bounds.height - 24, 0x7dd3fc, 0.06).setStrokeStyle(4, 0x7dd3fc, 0.76).setDepth(-12);
    const plus = this.add.text(bounds.centerX, bounds.centerY - 12, '+', { fontFamily: 'monospace', fontSize: '56px', color: '#7dd3fc' }).setOrigin(0.5).setDepth(-11.9);
    const label = this.add.text(bounds.centerX, bounds.centerY + 28, 'Add Cell', { fontFamily: 'monospace', fontSize: '20px', color: '#e0f2fe' }).setOrigin(0.5).setDepth(-11.9);
    const zone = this.add.zone(bounds.centerX, bounds.centerY, bounds.width, bounds.height).setInteractive({ useHandCursor: true }).setDepth(-11.8);
    zone.on('pointerdown', (pointer) => {
      if (isPanGesture(pointer, this.keySpace)) {
        this.startPanDrag(pointer);
        return;
      }
      this.callbacks.onAddCell?.(candidate);
    });
    [panel, plus, label, zone].forEach((item) => {
      item.__isAddCellAffordance = true;
      this.sceneObjects.push(item);
    });
  }

  createRecord(entry) {
    if (entry.definition.shape === 'rect') {
      return this.createSurfaceRecord(entry);
    }
    if (entry.type === 'spawn') return this.createSpriteRecord(entry, new Player(this, entry.object.x, entry.object.y, this.manifest.player), (sprite) => { sprite.body.setAllowGravity(false); sprite.setCollideWorldBounds(false); freezeAnimatedObject(sprite, 0); });
    if (entry.type === 'coins') return this.createSpriteRecord(entry, new Coin(this, entry.object.x, entry.object.y, this.manifest.coin), (sprite) => freezeAnimatedObject(sprite, 0));
    if (entry.type === 'ghosts') return this.createSpriteRecord(entry, new GhostMinion(this, entry.object.x, entry.object.y, this.manifest.ghost, entry.object), (sprite) => freezeAnimatedObject(sprite, 0));
    if (entry.type === 'projectileEnemies') return this.createSpriteRecord(entry, new ProjectileCaster(this, entry.object.x, entry.object.y, this.manifest.projectileCaster, entry.object), (sprite) => { freezeAnimatedObject(sprite, 0); sprite.clearTint(); });
    if (entry.type === 'portal') return this.createPortalRecord(entry);
    if (entry.type === 'villain') return this.createVillainRecord(entry);
    return null;
  }

  createSurfaceRecord(entry) {
    const metrics = getGameOneSurfaceMetrics(this.manifest, entry.object);
    const width = Number(entry.object.width || 120);
    const isInvisibleSurface = Boolean(entry.object?.invisible);
    const surfaceHeight = isInvisibleSurface
      ? Number(entry.object.height || entry.object.bodyHeight || metrics.bodyHeight || 36)
      : metrics.visualHeight;

    const visual = isInvisibleSurface
      ? this.add.rectangle(entry.object.x, entry.object.y, width, surfaceHeight, 0x000000, 0)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0x67e8f9, 0.95)
      : this.add.tileSprite(entry.object.x, entry.object.y, width, metrics.visualHeight, metrics.textureMeta.key).setOrigin(0.5);
    const zone = this.add.zone(entry.object.x, entry.object.y, width, surfaceHeight).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const record = {
      entry: { ...entry, object: { ...entry.object } },
      root: visual,
      zone,
      metrics,
      getVisualBounds: () => rectFromBounds(visual.x - (visual.width / 2), visual.y - (visual.height / 2), visual.width, visual.height),
      getBodyBounds: () => rectFromBounds(record.entry.object.x - (record.metrics.bodyWidth / 2), record.entry.object.y + record.metrics.bodyOffsetY - (record.metrics.bodyHeight / 2), record.metrics.bodyWidth, record.metrics.bodyHeight),
      setFromObject: (nextObject) => {
        record.entry.object = { ...nextObject };
        record.metrics = getGameOneSurfaceMetrics(this.manifest, nextObject);
        visual.setPosition(nextObject.x, nextObject.y);
        const nextWidth = Number(nextObject.width || 120);
        const nextHeight = isInvisibleSurface
          ? Number(nextObject.height || nextObject.bodyHeight || record.metrics.bodyHeight || 36)
          : record.metrics.visualHeight;

        visual.width = nextWidth;
        visual.height = nextHeight;

        if (!isInvisibleSurface) {
          visual.setTexture(record.metrics.textureMeta.key);
          visual.clearTint();
          visual.setAlpha(entry.type === 'unlockPlatforms' && nextObject.startsHidden ? 0.55 : 1);
          if (entry.type === 'barriers') {
            visual.setTint(0xeab308);
          }
        } else {
          visual.setFillStyle(0x000000, 0);
          visual.setStrokeStyle(2, 0x67e8f9, entry.type === 'unlockPlatforms' && nextObject.startsHidden ? 0.55 : 0.95);
        }

        zone.setPosition(nextObject.x, nextObject.y);
        zone.setSize(nextWidth, nextHeight);
      },
    };
    record.setFromObject(entry.object);
    zone.on('pointerdown', (pointer) => this.handleObjectPointerDown(pointer, record));
    this.sceneObjects.push(zone, visual);
    return record;
  }

  createSpriteRecord(entry, sprite, freeze) {
    freeze?.(sprite);
    const zone = this.add.zone(sprite.x, sprite.y, Math.max(sprite.displayWidth, 36), Math.max(sprite.displayHeight, 36)).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const record = {
      entry: { ...entry, object: { ...entry.object } },
      root: sprite,
      zone,
      extras: [],
      getVisualBounds: () => combineBounds([sprite, ...record.extras]),
      getBodyBounds: () => sprite.body ? rectFromBounds(sprite.body.x, sprite.body.y, sprite.body.width, sprite.body.height) : null,
      setFromObject: (nextObject) => {
        record.entry.object = { ...nextObject };
        sprite.setPosition(nextObject.x, nextObject.y);
        sprite.body?.updateFromGameObject?.();
        const bounds = combineBounds([sprite, ...record.extras]);
        zone.setPosition(bounds.centerX, bounds.centerY);
        zone.setSize(Math.max(bounds.width, 36), Math.max(bounds.height, 36));
      },
    };
    record.setFromObject(entry.object);
    zone.on('pointerdown', (pointer) => this.handleObjectPointerDown(pointer, record));
    this.sceneObjects.push(zone, sprite);
    return record;
  }

  createPortalRecord(entry) {
    const portal = new Portal(this, entry.object.x, entry.object.y, this.manifest.portal, entry.object);
    const record = this.createSpriteRecord(entry, portal, () => freezeAnimatedObject(portal, 0));
    record.extras = portal.lockLayers;
    portal.lockLayers.forEach((layer) => this.sceneObjects.push(layer));
    record.setFromObject = (nextObject) => {
      record.entry.object = { ...nextObject };
      portal.setPosition(nextObject.x, nextObject.y);
      portal.setLocked(Boolean(nextObject.locked));
      portal.endsLevel = Boolean(nextObject.endsLevel);
      portal.linkName = typeof nextObject.linkName === 'string' ? nextObject.linkName.trim() : '';
      freezeAnimatedObject(portal, 0);
      portal.lockLayers.forEach((layer, index) => {
        if (index < 2) layer.setPosition(nextObject.x, nextObject.y + 8);
        else if (index < 4) layer.setPosition(nextObject.x + (index === 2 ? -14 : 14), nextObject.y + 8);
        else if (index === 4) layer.setPosition(nextObject.x, nextObject.y - 16);
        else layer.setPosition(nextObject.x, nextObject.y + 32);
      });
      const bounds = combineBounds([portal, ...portal.lockLayers]);
      record.zone.setPosition(bounds.centerX, bounds.centerY);
      record.zone.setSize(Math.max(bounds.width, 42), Math.max(bounds.height, 42));
    };
    record.setFromObject(entry.object);
    return record;
  }

  createVillainRecord(entry) {
    const villain = new VillainTrigger(this, entry.object.x, entry.object.y, this.manifest.villain, entry.object);
    villain.hoverTween?.stop();
    villain.hoverTween = null;
    const extras = [villain.pedestal, villain.pedestalCap, villain.statusBack, villain.statusLabel].filter(Boolean);
    const record = this.createSpriteRecord(entry, villain, () => freezeAnimatedObject(villain, 0));
    record.extras = extras;
    extras.forEach((extra) => this.sceneObjects.push(extra));
    record.setFromObject = (nextObject) => {
      record.entry.object = { ...nextObject };
      villain.setPosition(nextObject.x, nextObject.y);
      if (villain.pedestal) villain.pedestal.setPosition(nextObject.x, nextObject.y + 56);
      if (villain.pedestalCap) villain.pedestalCap.setPosition(nextObject.x, nextObject.y + 46);
      if (villain.statusBack) villain.statusBack.setPosition(nextObject.x, nextObject.y - 74);
      if (villain.statusLabel) villain.statusLabel.setPosition(nextObject.x, nextObject.y - 74);
      const bounds = combineBounds([villain, ...extras]);
      record.zone.setPosition(bounds.centerX, bounds.centerY);
      record.zone.setSize(Math.max(bounds.width, 42), Math.max(bounds.height, 42));
    };
    record.setFromObject(entry.object);
    return record;
  }

  handleCellPointerDown(pointer, cellRecord) {
    if (isPanGesture(pointer, this.keySpace)) {
      this.startPanDrag(pointer);
      return;
    }
    this.callbacks.onCellSelect?.(cellRecord.cell.id);
    this.callbacks.onBackgroundClick?.({ cellId: cellRecord.cell.id, point: { x: pointer.worldX, y: pointer.worldY } });
  }

  handleObjectPointerDown(pointer, record) {
    if (isPanGesture(pointer, this.keySpace)) {
      this.startPanDrag(pointer);
      return;
    }
    const additive = Boolean(pointer.event?.shiftKey);
    const currentSelection = this.editorState.selectedObjectIds || [];
    const nextSelection = additive
      ? (currentSelection.includes(record.entry.editorId) ? currentSelection.filter((id) => id !== record.entry.editorId) : [...currentSelection, record.entry.editorId])
      : (currentSelection.includes(record.entry.editorId) ? currentSelection : [record.entry.editorId]);
    this.callbacks.onSelectionChange?.(nextSelection);
    if (additive) {
      return;
    }
    this.dragState = {
      mode: 'move',
      origin: { x: pointer.worldX, y: pointer.worldY },
      records: nextSelection.map((id) => this.objectRecords.get(id)).filter(Boolean),
      startPositions: Object.fromEntries(nextSelection.map((id) => {
        const entry = this.objectRecords.get(id)?.entry?.object || {};
        return [id, { x: Number(entry.x || 0), y: Number(entry.y || 0) }];
      })),
    };
  }

  buildResizeState(axis, pointer) {
    const record = this.objectRecords.get(this.editorState.selectedObjectIds?.[0]);
    if (!record || !isRectEntry(record.entry)) {
      return null;
    }
    return {
      mode: axis === 'height' ? 'resize-height' : 'resize-width',
      origin: { x: pointer.worldX, y: pointer.worldY },
      record,
      startSize: { width: Number(record.entry.object.width || 120), height: Number(record.entry.object.height || record.metrics?.visualHeight || 60) },
      startPosition: { x: Number(record.entry.object.x || 0), y: Number(record.entry.object.y || 0) },
    };
  }

  handlePointerMove(pointer) {
    if (!this.dragState && pointer.isDown && this.keySpace.isDown) {
      this.startPanDrag(pointer);
      return;
    }
    if (!this.dragState) {
      return;
    }
    if (this.dragState.mode === 'pan') {
      if (!(pointer.leftButtonDown() || pointer.middleButtonDown() || pointer.rightButtonDown())) {
        this.cancelDragState();
        return;
      }
      this.cameras.main.scrollX = this.dragState.scroll.x - ((pointer.x - this.dragState.origin.x) / this.cameras.main.zoom);
      this.cameras.main.scrollY = this.dragState.scroll.y - ((pointer.y - this.dragState.origin.y) / this.cameras.main.zoom);
      this.clampCameraToWorld();
      this.emitCameraChange();
      return;
    }
    if (!pointer.leftButtonDown()) {
      this.cancelDragState();
      return;
    }
    const gridSize = Number(this.editorState.settings?.gridSize || 20);
    const snapEnabled = Boolean(this.editorState.settings?.snapEnabled);
    const deltaX = snapEnabled ? Math.round((pointer.worldX - this.dragState.origin.x) / gridSize) * gridSize : Math.round(pointer.worldX - this.dragState.origin.x);
    const deltaY = snapEnabled ? Math.round((pointer.worldY - this.dragState.origin.y) / gridSize) * gridSize : Math.round(pointer.worldY - this.dragState.origin.y);
    if (this.dragState.mode === 'move') {
      const changes = this.dragState.records.map((record) => ({ editorId: record.entry.editorId, x: this.dragState.startPositions[record.entry.editorId].x + deltaX, y: this.dragState.startPositions[record.entry.editorId].y + deltaY }));
      changes.forEach((change) => this.objectRecords.get(change.editorId)?.setFromObject({ ...this.objectRecords.get(change.editorId).entry.object, x: change.x, y: change.y }));
      this.callbacks.onMoveObjects?.(changes);
      this.renderOverlay();
      return;
    }
    if (this.dragState.mode === 'resize-width') {
      const nextWidth = Math.max(gridSize * 2, this.dragState.startSize.width + deltaX);
      const appliedDelta = nextWidth - this.dragState.startSize.width;
      const nextObject = { ...this.dragState.record.entry.object, width: nextWidth, x: this.dragState.startPosition.x + (appliedDelta / 2) };
      this.dragState.record.setFromObject(nextObject);
      this.callbacks.onResizeObject?.({ editorId: this.dragState.record.entry.editorId, x: nextObject.x, width: nextWidth });
      this.renderOverlay();
      return;
    }
    const nextHeight = Math.max(gridSize, this.dragState.startSize.height + deltaY);
    const appliedDelta = nextHeight - this.dragState.startSize.height;
    const nextObject = { ...this.dragState.record.entry.object, height: nextHeight, y: this.dragState.startPosition.y + (appliedDelta / 2) };
    this.dragState.record.setFromObject(nextObject);
    this.callbacks.onResizeObject?.({ editorId: this.dragState.record.entry.editorId, y: nextObject.y, height: nextHeight, bodyHeight: Math.min(Number(this.dragState.record.entry.object.bodyHeight || nextHeight), nextHeight) });
    this.renderOverlay();
  }

  handlePointerUp() {
    this.cancelDragState();
  }

  handleWheel(pointer, _gameObjects, _deltaX, deltaY) {
    if (!this.isCameraNavigationEnabled()) {
      return;
    }

    this.setZoom(this.cameras.main.zoom + (deltaY > 0 ? -0.12 : 0.12), pointer.x, pointer.y);
  }

  renderOverlay() {
    destroyAll(this.handleObjects);
    this.handleObjects = [];
    this.gridGraphics.clear();
    this.selectionGraphics.clear();
    const bounds = this.worldLayout?.bounds;
    if (!bounds) {
      return;
    }
    if (this.editorState?.settings?.showGrid) {
      const gridSize = Number(this.editorState.settings.gridSize || 20);
      this.gridGraphics.lineStyle(1, 0xffffff, 0.08);
      for (let x = bounds.left; x <= bounds.right; x += gridSize) this.gridGraphics.lineBetween(x, bounds.top, x, bounds.bottom);
      for (let y = bounds.top; y <= bounds.bottom; y += gridSize) this.gridGraphics.lineBetween(bounds.left, y, bounds.right, y);
    }
    this.gridGraphics.lineStyle(3, 0x94a3b8, 0.25);
    this.worldLayout.cells.forEach((record) => this.gridGraphics.strokeRect(record.bounds.left, record.bounds.top, record.bounds.width, record.bounds.height));
    const selectedCell = this.getSelectedCellRecord();
    if (selectedCell) {
      this.selectionGraphics.lineStyle(5, 0x10b981, 0.9);
      this.selectionGraphics.strokeRect(selectedCell.bounds.left + 4, selectedCell.bounds.top + 4, selectedCell.bounds.width - 8, selectedCell.bounds.height - 8);
    }
    const selected = (this.editorState?.selectedObjectIds || []).map((id) => this.objectRecords.get(id)).filter(Boolean);
    selected.forEach((record) => {
      const box = record.getVisualBounds();
      this.selectionGraphics.lineStyle(3, 0xf8fafc, 0.92);
      this.selectionGraphics.strokeRect(box.x - 4, box.y - 4, box.width + 8, box.height + 8);
      if (this.editorState?.settings?.showHitboxes) {
        const bodyBounds = record.getBodyBounds?.();
        if (bodyBounds) {
          this.selectionGraphics.lineStyle(2, 0xf97316, 0.88);
          this.selectionGraphics.strokeRect(bodyBounds.x, bodyBounds.y, bodyBounds.width, bodyBounds.height);
        }
      }
    });
    if (selected.length === 1 && isRectEntry(selected[0].entry)) {
      const box = selected[0].getVisualBounds();
      const widthHandle = this.add.circle(box.right, box.centerY, HANDLE_RADIUS, 0x34d399, 1).setStrokeStyle(3, 0x064e3b, 1).setInteractive({ useHandCursor: true }).setDepth(29);
      const heightHandle = this.add.circle(box.centerX, box.bottom, HANDLE_RADIUS, 0x38bdf8, 1).setStrokeStyle(3, 0x0f172a, 1).setInteractive({ useHandCursor: true }).setDepth(29);
      widthHandle.on('pointerdown', (pointer) => { this.dragState = this.buildResizeState('width', pointer); });
      heightHandle.on('pointerdown', (pointer) => { this.dragState = this.buildResizeState('height', pointer); });
      this.handleObjects.push(widthHandle, heightHandle);
    }
  }
}
