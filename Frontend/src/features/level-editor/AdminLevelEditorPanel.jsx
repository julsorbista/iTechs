import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Download,
  Gamepad2,
  Loader2,
  RotateCcw,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { adminLevelAPI, handleAPIError } from '../../utils/api';
import GameCanvas from '../../games/game-one/ui/GameCanvas';
import { buildWorldGridLayout, getCellRecordAtWorldPoint } from '../../games/game-one/systems/roomFlow';
import FieldControl from './FieldControl';
import {
  CELL_FIELD_DEFINITIONS,
  WORLD_OBJECT_DEFINITIONS,
  WORLD_OBJECT_ORDER,
  getLevelEditorSource,
} from './levelEditorConfig';
import {
  cleanLevelData,
  cloneValue,
  coerceFieldValue,
  collectWorldObjects,
  createEditorId,
  getCellObjectEntries,
  getDefaultTextureKey,
  getFirstQuestionId,
  getNextCellId,
  getNextObjectId,
  normalizeLevelData,
  removeWorldObject,
  snapValue,
  updateWorldObject,
} from './levelEditorUtils';
import {
  clearLevelEditorDraft,
  loadLevelEditorDraft,
  saveLevelEditorDraft,
} from './levelEditorStorage';
import {
  getBackgroundPreview,
  getCellValidationMessages,
  getLevelValidationMessages,
  getObjectValidationMessages,
  getPalettePreview,
  groupFieldDefinitions,
} from './levelEditorPresentation';
import GameOneEditorCanvas from './components/GameOneEditorCanvas';
import LevelEditorObjectPreview from './components/LevelEditorObjectPreview';
import LevelEditorValidationBadgeList from './components/LevelEditorValidationBadgeList';

const GRID_SIZE = 20;

const fieldGridClassName = (field) => (field.type === 'textarea' ? 'md:col-span-2' : '');
const isInteractiveElement = (target) => target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, button, [contenteditable="true"]'));
const getDraftFromStorage = (source, levelNumber, baseLevelData) => (source ? normalizeLevelData(loadLevelEditorDraft(source.gameType, levelNumber) || baseLevelData, source) : null);

const buildPlaytestResult = (result, gameplay) => {
  const wrongAnswers = Number(gameplay?.wrongAnswers || 0);
  const coinsCollected = Number(gameplay?.coinsCollected || 0);
  return {
    result,
    starsEarned: result === 'COMPLETED' ? Math.max(1, 3 - Math.min(2, wrongAnswers)) : 0,
    finalScore: Math.max(0, (coinsCollected * 100) + (result === 'COMPLETED' ? 500 : 0) - (wrongAnswers * 50)),
  };
};

const TogglePill = ({ checked, label, onChange }) => (
  <label className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
    checked ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
  }`}>
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
    {label}
  </label>
);

const FieldGroupSection = ({ label, fields, values, onChange, context, idPrefix }) => (
  <section className="space-y-3 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map((field) => (
        <div key={`${idPrefix}-${field.key}`} className={fieldGridClassName(field)}>
          <FieldControl field={field} value={values[field.key]} onChange={(value) => onChange(field, value)} context={context} />
        </div>
      ))}
    </div>
  </section>
);

const AdminLevelEditorPanel = ({ mode = 'embedded' }) => {
  const isFullscreen = mode === 'fullscreen';
  const navigate = useNavigate();
  const [catalogGames, setCatalogGames] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);
  const [selectedGameType, setSelectedGameType] = useState('GAME_ONE');
  const [selectedLevelNumber, setSelectedLevelNumber] = useState(1);
  const [levelDraft, setLevelDraft] = useState(null);
  const [editorMeta, setEditorMeta] = useState(null);
  const [selectedCellId, setSelectedCellId] = useState(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState([]);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showHitboxes, setShowHitboxes] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [showLinks, setShowLinks] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPlaytesting, setIsPlaytesting] = useState(false);
  const [playtestNonce, setPlaytestNonce] = useState(0);
  const [playtestGameplay, setPlaytestGameplay] = useState(null);
  const [playtestResult, setPlaytestResult] = useState(null);

  const supportedCatalogGames = useMemo(() => catalogGames.filter((game) => Boolean(getLevelEditorSource(game.gameType))), [catalogGames]);
  const gameOptions = useMemo(() => supportedCatalogGames.map((game) => ({ value: game.gameType, label: `${game.label} - ${game.title}` })), [supportedCatalogGames]);
  const levelOptions = useMemo(() => (supportedCatalogGames.find((game) => game.gameType === selectedGameType)?.levels || []).map((level) => ({ value: level.levelNumber, label: `Level ${level.levelNumber}` })), [selectedGameType, supportedCatalogGames]);
  const source = useMemo(() => {
    const runtimeSource = getLevelEditorSource(selectedGameType);
    return runtimeSource ? { ...runtimeSource, defaultLevelNumber: selectedLevelNumber } : null;
  }, [selectedGameType, selectedLevelNumber]);

  useEffect(() => {
    if (levelOptions.length > 0 && !levelOptions.some((option) => option.value === selectedLevelNumber)) {
      setSelectedLevelNumber(levelOptions[0].value);
    }
  }, [levelOptions, selectedLevelNumber]);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        const response = await adminLevelAPI.getLevelCatalog();
        if (!cancelled && response.status === 'success') {
          const nextGames = response.data.games || [];
          setCatalogGames(nextGames);
          setSelectedGameType((current) => nextGames.some((game) => Boolean(getLevelEditorSource(game.gameType)) && game.gameType === current)
            ? current
            : nextGames.find((game) => Boolean(getLevelEditorSource(game.gameType)))?.gameType || current);
        }
      } catch (error) {
        if (!cancelled) toast.error(handleAPIError(error).message);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    };
    loadCatalog();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!source || !selectedLevelNumber) {
      setLevelDraft(null);
      setEditorMeta(null);
      setContentLoading(false);
      return;
    }
    let cancelled = false;
    const loadContent = async () => {
      try {
        setContentLoading(true);
        const response = await adminLevelAPI.getLevelContent(selectedGameType, selectedLevelNumber);
        if (cancelled || response.status !== 'success') return;
        const nextMeta = response.data;
        const nextDraft = getDraftFromStorage(source, selectedLevelNumber, nextMeta.content?.draftJson);
        setEditorMeta(nextMeta);
        setLevelDraft(nextDraft);
        setSelectedCellId(nextDraft?.grid?.cells?.[0]?.id || null);
        setSelectedObjectIds([]);
        setIsPlaytesting(false);
      } catch (error) {
        if (!cancelled) {
          setLevelDraft(null);
          setEditorMeta(null);
          toast.error(handleAPIError(error).message);
        }
      } finally {
        if (!cancelled) setContentLoading(false);
      }
    };
    loadContent();
    return () => { cancelled = true; };
  }, [selectedGameType, selectedLevelNumber, source]);

  useEffect(() => {
    if (levelDraft && source) {
      saveLevelEditorDraft(source.gameType, selectedLevelNumber, cleanLevelData(levelDraft));
    }
  }, [levelDraft, selectedLevelNumber, source]);

  const worldLayout = useMemo(() => (levelDraft ? buildWorldGridLayout(levelDraft) : null), [levelDraft]);
  const cells = worldLayout?.cells || [];
  const selectedCellRecord = useMemo(() => worldLayout?.byId?.get(selectedCellId) || cells[0] || null, [cells, selectedCellId, worldLayout]);
  const selectedCell = selectedCellRecord?.cell || null;
  const worldObjects = useMemo(() => collectWorldObjects(levelDraft), [levelDraft]);
  const selectedObjects = useMemo(() => worldObjects.filter((entry) => selectedObjectIds.includes(entry.editorId)), [selectedObjectIds, worldObjects]);
  const selectedObject = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const selectedCellObjects = useMemo(() => (selectedCell ? getCellObjectEntries(levelDraft, selectedCell.id, source) : []), [levelDraft, selectedCell, source]);
  const normalizedServerDraft = useMemo(() => (source && editorMeta ? normalizeLevelData(editorMeta.content?.draftJson, source) : null), [editorMeta, source]);
  const cleanedLevelDraft = useMemo(() => (levelDraft ? cleanLevelData(levelDraft) : null), [levelDraft]);
  const exportJson = useMemo(() => (cleanedLevelDraft ? JSON.stringify(cleanedLevelDraft, null, 2) : ''), [cleanedLevelDraft]);
  const hasUnsavedLocalChanges = useMemo(() => {
    if (!cleanedLevelDraft || !normalizedServerDraft) return false;
    return JSON.stringify(cleanedLevelDraft) !== JSON.stringify(cleanLevelData(normalizedServerDraft));
  }, [cleanedLevelDraft, normalizedServerDraft]);
  const cellFieldGroups = useMemo(() => groupFieldDefinitions(CELL_FIELD_DEFINITIONS.filter((field) => field.key !== 'id')), []);
  const selectedObjectFieldGroups = useMemo(() => groupFieldDefinitions(selectedObject?.definition?.fields || []), [selectedObject]);
  const selectedObjectValidationMessages = useMemo(() => (selectedObject ? getObjectValidationMessages({ entry: selectedObject, levelData: levelDraft, source }) : []), [levelDraft, selectedObject, source]);
  const selectedCellValidationMessages = useMemo(() => getCellValidationMessages({ cell: selectedCell, levelData: levelDraft, source, cellObjects: selectedCellObjects }), [levelDraft, selectedCell, selectedCellObjects, source]);
  const levelValidationMessages = useMemo(() => getLevelValidationMessages({ levelData: levelDraft }), [levelDraft]);
  const overlaySettings = useMemo(() => ({ gridSize: GRID_SIZE, snapEnabled: snapToGridEnabled, showGrid, showHitboxes, showGuides, showLinks }), [showGrid, showGuides, showHitboxes, showLinks, snapToGridEnabled]);
  const canDeleteSelectedCell = useMemo(() => selectedCell && selectedCellObjects.length === 0 && cells.length > 1, [cells.length, selectedCell, selectedCellObjects.length]);

  useEffect(() => {
    if (!cells.length) {
      setSelectedCellId(null);
      return;
    }
    if (!cells.some((record) => record.cell.id === selectedCellId)) {
      setSelectedCellId(cells[0].cell.id);
    }
  }, [cells, selectedCellId]);

  useEffect(() => {
    const availableIds = new Set(worldObjects.map((entry) => entry.editorId));
    setSelectedObjectIds((previous) => previous.filter((id) => availableIds.has(id)));
  }, [worldObjects]);

  const setNormalizedDraft = useCallback((nextDraft) => {
    setLevelDraft(nextDraft);
    setSelectedCellId((current) => (nextDraft?.grid?.cells?.some((cell) => cell.id === current) ? current : nextDraft?.grid?.cells?.[0]?.id || null));
    setSelectedObjectIds([]);
  }, []);

  const updateLevelField = useCallback((key, value) => setLevelDraft((previous) => (previous ? { ...previous, [key]: value } : previous)), []);
  const updateViewportField = useCallback((key, value) => setLevelDraft((previous) => (previous ? { ...previous, viewport: { ...previous.viewport, [key]: Math.max(320, Number(value) || previous.viewport[key]) } } : previous)), []);
  const updateSelectedCellField = useCallback((field, value) => setLevelDraft((previous) => (previous ? {
    ...previous,
    grid: { ...previous.grid, cells: previous.grid.cells.map((cell) => cell.id === selectedCellId ? { ...cell, [field.key]: coerceFieldValue(field, value) } : cell) },
  } : previous)), [selectedCellId]);
  const updateSelectedObjectField = useCallback((field, value) => setLevelDraft((previous) => (previous && selectedObject ? updateWorldObject(previous, selectedObject.editorId, (object) => ({ ...object, [field.key]: coerceFieldValue(field, value) })) : previous)), [selectedObject]);

  const addCell = useCallback((candidate) => {
    if (!levelDraft || !source || !candidate) return;
    const exists = levelDraft.grid.cells.some((cell) => Number(cell.col) === Number(candidate.col) && Number(cell.row) === Number(candidate.row));
    if (exists) return;
    const nextCell = source.createBlankCell({ nextCellId: getNextCellId(levelDraft.grid.cells), col: candidate.col, row: candidate.row });
    setLevelDraft((previous) => ({ ...previous, grid: { ...previous.grid, cells: [...previous.grid.cells, nextCell] } }));
    setSelectedCellId(nextCell.id);
    setSelectedObjectIds([]);
    toast.success(`Added ${nextCell.id}.`);
  }, [levelDraft, source]);

  const deleteSelectedCell = useCallback(() => {
    if (!selectedCell || !canDeleteSelectedCell) {
      toast.error('Clear the cell before deleting it, and keep at least one cell in the level.');
      return;
    }
    setLevelDraft((previous) => ({ ...previous, grid: { ...previous.grid, cells: previous.grid.cells.filter((cell) => cell.id !== selectedCell.id) } }));
    setSelectedCellId(cells.find((record) => record.cell.id !== selectedCell.id)?.cell.id || null);
    setSelectedObjectIds([]);
    toast.success(`${selectedCell.id} removed.`);
  }, [canDeleteSelectedCell, cells, selectedCell]);

  const addObject = useCallback((type, position = null) => {
    if (!levelDraft || !selectedCellRecord || !source) return;
    const definition = WORLD_OBJECT_DEFINITIONS[type];
    const existingSingleton = definition.singleton ? levelDraft.worldObjects[definition.storageKey] : null;
    if (existingSingleton) {
      setSelectedObjectIds([existingSingleton._editorId]);
      toast.error(`${definition.label} already exists in this level.`);
      return;
    }
    const targetCellRecord = position ? getCellRecordAtWorldPoint(worldLayout, position.x, position.y) : selectedCellRecord;
    if (!targetCellRecord) {
      toast.error('Drop components inside an existing cell.');
      return;
    }
    const defaults = definition.defaultValue({
      nextId: getNextObjectId(levelDraft, type),
      defaultTextureKey: getDefaultTextureKey(source),
      firstQuestionId: getFirstQuestionId(levelDraft),
    });
    const nextObject = {
      ...defaults,
      _editorId: createEditorId(type),
      x: position ? snapValue(position.x, snapToGridEnabled, GRID_SIZE) : targetCellRecord.bounds.left + Number(defaults.x || (targetCellRecord.bounds.width / 2)),
      y: position ? snapValue(position.y, snapToGridEnabled, GRID_SIZE) : targetCellRecord.bounds.top + Number(defaults.y || (targetCellRecord.bounds.height / 2)),
    };
    if (type === 'portal') nextObject.endsLevel = true;
    setLevelDraft((previous) => ({
      ...previous,
      worldObjects: {
        ...previous.worldObjects,
        [definition.storageKey]: definition.singleton ? nextObject : [...previous.worldObjects[definition.storageKey], nextObject],
      },
    }));
    setSelectedObjectIds([nextObject._editorId]);
  }, [levelDraft, selectedCellRecord, snapToGridEnabled, source, worldLayout]);

  const removeSelectedObjects = useCallback(() => {
    const removableIds = selectedObjectIds.filter((editorId) => worldObjects.find((entry) => entry.editorId === editorId)?.type !== 'spawn');
    if (!removableIds.length) {
      toast.error('Spawn stays in the map. Move it instead.');
      return;
    }
    setLevelDraft((previous) => removableIds.reduce((draft, editorId) => removeWorldObject(draft, editorId), previous));
    setSelectedObjectIds((previous) => previous.filter((editorId) => !removableIds.includes(editorId)));
  }, [selectedObjectIds, worldObjects]);

  const duplicateSelectedObjects = useCallback(() => {
    const duplicateable = selectedObjects.filter((entry) => !entry.singleton && entry.type !== 'spawn');
    if (!duplicateable.length || !levelDraft) return;
    const nextSelectedIds = [];
    setLevelDraft((previous) => duplicateable.reduce((draft, entry, index) => {
      const copy = {
        ...cloneValue(entry.object),
        id: getNextObjectId(draft, entry.type),
        _editorId: createEditorId(`${entry.type}-copy`),
        x: Number(entry.object.x || 0) + ((index + 1) * GRID_SIZE),
        y: Number(entry.object.y || 0) + ((index + 1) * GRID_SIZE),
      };
      nextSelectedIds.push(copy._editorId);
      return { ...draft, worldObjects: { ...draft.worldObjects, [entry.storageKey]: [...draft.worldObjects[entry.storageKey], copy] } };
    }, previous));
    setSelectedObjectIds(nextSelectedIds);
    toast.success(`${duplicateable.length} item${duplicateable.length === 1 ? '' : 's'} duplicated.`);
  }, [levelDraft, selectedObjects]);

  const syncLevelFromServer = useCallback((nextMeta, successMessage = '') => {
    if (!source) return;
    clearLevelEditorDraft(selectedGameType, selectedLevelNumber);
    setNormalizedDraft(normalizeLevelData(nextMeta.content?.draftJson, source));
    setEditorMeta(nextMeta);
    if (successMessage) toast.success(successMessage);
  }, [selectedGameType, selectedLevelNumber, setNormalizedDraft, source]);

  const saveDraft = useCallback(async ({ silent = false } = {}) => {
    if (!cleanedLevelDraft) return null;
    setIsSavingDraft(true);
    try {
      const response = await adminLevelAPI.saveLevelDraft(selectedGameType, selectedLevelNumber, cleanedLevelDraft);
      if (response.status === 'success') {
        syncLevelFromServer(response.data, silent ? '' : 'Draft saved to the backend.');
        return response.data;
      }
      return null;
    } catch (error) {
      toast.error(handleAPIError(error).message);
      return null;
    } finally {
      setIsSavingDraft(false);
    }
  }, [cleanedLevelDraft, selectedGameType, selectedLevelNumber, syncLevelFromServer]);

  const publishDraft = useCallback(async () => {
    setIsPublishing(true);
    try {
      if (hasUnsavedLocalChanges) {
        const saved = await saveDraft({ silent: true });
        if (!saved) return;
      }
      const response = await adminLevelAPI.publishLevelContent(selectedGameType, selectedLevelNumber);
      if (response.status === 'success') syncLevelFromServer(response.data, 'Level published for student gameplay.');
    } catch (error) {
      toast.error(handleAPIError(error).message);
    } finally {
      setIsPublishing(false);
    }
  }, [hasUnsavedLocalChanges, saveDraft, selectedGameType, selectedLevelNumber, syncLevelFromServer]);

  const resetDraft = useCallback(() => {
    if (!normalizedServerDraft) return;
    clearLevelEditorDraft(selectedGameType, selectedLevelNumber);
    setNormalizedDraft(cloneValue(normalizedServerDraft));
    toast.success('Unsaved local changes were discarded.');
  }, [normalizedServerDraft, selectedGameType, selectedLevelNumber, setNormalizedDraft]);

  const copyJson = useCallback(async () => {
    if (!exportJson) return;
    try {
      await navigator.clipboard.writeText(exportJson);
      toast.success('Level JSON copied to clipboard.');
    } catch {
      toast.error('Clipboard access is unavailable here.');
    }
  }, [exportJson]);

  const downloadJson = useCallback(() => {
    if (!levelDraft) return;
    const blob = new Blob([exportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${levelDraft.id || `level-${selectedLevelNumber}`}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [exportJson, levelDraft, selectedLevelNumber]);

  const startPlaytest = useCallback(() => {
    setPlaytestGameplay(null);
    setPlaytestResult(null);
    setPlaytestNonce((value) => value + 1);
    setIsPlaytesting(true);
  }, []);

  const exitPlaytest = useCallback(() => setIsPlaytesting(false), []);
  const retryPlaytest = useCallback(() => {
    setPlaytestGameplay(null);
    setPlaytestResult(null);
    setPlaytestNonce((value) => value + 1);
  }, []);

  const handlePlaytestOutcome = useCallback((result, gameplay) => {
    setPlaytestGameplay(gameplay);
    setPlaytestResult(buildPlaytestResult(result, gameplay));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!levelDraft || isInteractiveElement(event.target)) return;
      if (event.key === 'Escape') {
        setSelectedObjectIds([]);
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedObjectIds.length > 0) {
        event.preventDefault();
        removeSelectedObjects();
        return;
      }
      const directionMap = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
      const direction = directionMap[event.key];
      if (!direction || selectedObjectIds.length === 0) return;
      event.preventDefault();
      const step = event.shiftKey ? GRID_SIZE : 1;
      setLevelDraft((previous) => selectedObjectIds.reduce((draft, editorId) => updateWorldObject(draft, editorId, (object) => ({
        ...object,
        x: Number(object.x || 0) + (direction.x * step),
        y: Number(object.y || 0) + (direction.y * step),
      })), previous));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [levelDraft, removeSelectedObjects, selectedObjectIds]);

  if (catalogLoading || contentLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-white/90 p-8 text-sm text-slate-500 shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          <span>Loading level editor content...</span>
        </div>
      </div>
    );
  }

  if (!levelDraft || !source) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 text-sm text-slate-500 shadow-sm">
        No editor source is configured for this level yet.
      </div>
    );
  }

  return (
    <div className={isFullscreen ? 'space-y-4' : 'space-y-6'}>
      <section className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">Level Editor</p>
            <h2 className="text-xl font-semibold text-slate-900">One continuous map workspace</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">Each grid cell is one camera-sized screen. Zoom out to add adjacent cells, edit each cell’s background, and playtest the current unsaved draft inline.</p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs font-medium text-slate-500">
              <span className={`rounded-full border px-3 py-1 ${hasUnsavedLocalChanges ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{hasUnsavedLocalChanges ? 'Unsaved local changes' : 'Draft synced'}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{cells.length} cell{cells.length === 1 ? '' : 's'}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">{worldObjects.length} object{worldObjects.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" onClick={() => navigate('/admin')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"><ArrowLeft className="h-4 w-4" />Back</button>
            <select value={selectedGameType} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(event) => setSelectedGameType(event.target.value)}>{gameOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <select value={selectedLevelNumber} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(event) => setSelectedLevelNumber(Number(event.target.value))}>{levelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <button type="button" onClick={startPlaytest} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"><Gamepad2 className="h-4 w-4" />Playtest Draft</button>
            <button type="button" onClick={() => saveDraft()} disabled={isSavingDraft || !hasUnsavedLocalChanges} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300">{isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Draft</button>
            <button type="button" onClick={publishDraft} disabled={isPublishing || isSavingDraft} className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60">{isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Publish</button>
            <button type="button" onClick={copyJson} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"><Copy className="h-4 w-4" />Copy</button>
            <button type="button" onClick={downloadJson} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"><Download className="h-4 w-4" />Download</button>
            <button type="button" onClick={resetDraft} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"><RotateCcw className="h-4 w-4" />Reset</button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <aside className="space-y-4 rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm">
          <section className="space-y-3 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Level</p>
            <FieldControl field={{ key: 'id', label: 'Level Id', type: 'text' }} value={levelDraft.id} onChange={(value) => updateLevelField('id', value)} context={{}} />
            <FieldControl field={{ key: 'title', label: 'Title', type: 'text' }} value={levelDraft.title} onChange={(value) => updateLevelField('title', value)} context={{}} />
            <FieldControl field={{ key: 'subtitle', label: 'Subtitle', type: 'textarea', rows: 2 }} value={levelDraft.subtitle} onChange={(value) => updateLevelField('subtitle', value)} context={{}} />
            <div className="grid grid-cols-2 gap-3">
              <FieldControl field={{ key: 'viewportWidth', label: 'Viewport Width', type: 'number' }} value={levelDraft.viewport.width} onChange={(value) => updateViewportField('width', value)} context={{}} />
              <FieldControl field={{ key: 'viewportHeight', label: 'Viewport Height', type: 'number' }} value={levelDraft.viewport.height} onChange={(value) => updateViewportField('height', value)} context={{}} />
            </div>
          </section>

          <section className="space-y-3 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Cells</p><h3 className="text-sm font-semibold text-slate-900">Map Grid</h3></div>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{cells.length}</span>
            </div>
            <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {cells.map((record) => {
                const previewUrl = getBackgroundPreview(record.cell.backgroundKey, source);
                const isSelected = record.cell.id === selectedCellId;
                return (
                  <button key={record.cell.id} type="button" onClick={() => { setSelectedCellId(record.cell.id); setSelectedObjectIds([]); }} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${isSelected ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/70'}`}>
                    <div className="h-14 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">{previewUrl ? <img src={previewUrl} alt="" className="h-full w-full object-cover" draggable={false} /> : null}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{record.cell.id}</p>
                      <p className="text-xs text-slate-500">Grid {record.cell.col}, {record.cell.row}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Palette</p><h3 className="text-sm font-semibold text-slate-900">World Components</h3></div>
            <div className="space-y-2">
              {WORLD_OBJECT_ORDER.map((type) => {
                const definition = WORLD_OBJECT_DEFINITIONS[type];
                const preview = getPalettePreview(type, source);
                return (
                  <div key={type} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-itechs-level-object', type); event.dataTransfer.setData('text/plain', type); }} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <LevelEditorObjectPreview preview={preview} fallbackLabel={definition.shortLabel} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{definition.label}</p>
                      <p className="text-xs text-slate-500">{definition.singleton ? 'Singleton' : 'Repeatable'}</p>
                    </div>
                    <button type="button" onClick={() => addObject(type)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">Add</button>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="space-y-4 rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Canvas</p>
              <h3 className="text-lg font-semibold text-slate-900">{isPlaytesting ? 'Live Draft Playtest' : 'Continuous Map Canvas'}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <TogglePill checked={snapToGridEnabled} label="Snap" onChange={setSnapToGridEnabled} />
              <TogglePill checked={showGrid} label="Grid" onChange={setShowGrid} />
              <TogglePill checked={showHitboxes} label="Hitboxes" onChange={setShowHitboxes} />
              <TogglePill checked={showGuides} label="Guides" onChange={setShowGuides} />
              <TogglePill checked={showLinks} label="Links" onChange={setShowLinks} />
            </div>
          </div>

          {isPlaytesting ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-[22px] border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                <span>Playing the current unsaved draft in the real GAME_ONE runtime.</span>
                <button type="button" onClick={exitPlaytest} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 font-semibold text-violet-700 transition hover:bg-violet-100"><X className="h-4 w-4" />Exit</button>
              </div>
              <GameCanvas
                key={`playtest-${playtestNonce}`}
                levelData={cleanedLevelDraft}
                runtimeAssets={source.runtimeAssets}
                onLevelComplete={(gameplay) => handlePlaytestOutcome('COMPLETED', gameplay)}
                onLevelFail={(gameplay) => handlePlaytestOutcome('FAILED', gameplay)}
                onExitRequest={exitPlaytest}
                resultData={playtestResult}
                gameplayData={playtestGameplay}
                isSubmitting={false}
                canAdvanceLevel={false}
                onRetry={retryPlaytest}
                onBack={exitPlaytest}
                onNextLevel={() => {}}
              />
            </div>
          ) : (
            <GameOneEditorCanvas
              className="w-full"
              levelData={levelDraft}
              runtimeAssets={source.runtimeAssets}
              selectedCellId={selectedCellId}
              selectedObjectIds={selectedObjectIds}
              settings={overlaySettings}
              onSelectionChange={setSelectedObjectIds}
              onCellSelect={setSelectedCellId}
              onBackgroundClick={({ cellId }) => { setSelectedCellId(cellId); setSelectedObjectIds([]); }}
              onAddCell={addCell}
              onAddObject={addObject}
              onMoveObjects={(changes) => setLevelDraft((previous) => changes.reduce((draft, change) => updateWorldObject(draft, change.editorId, (object) => ({ ...object, x: change.x, y: change.y })), previous))}
              onResizeObject={(change) => setLevelDraft((previous) => updateWorldObject(previous, change.editorId, (object) => ({ ...object, ...(change.width !== undefined ? { width: change.width } : {}), ...(change.height !== undefined ? { height: change.height } : {}), ...(change.bodyHeight !== undefined ? { bodyHeight: change.bodyHeight } : {}), ...(change.x !== undefined ? { x: change.x } : {}), ...(change.y !== undefined ? { y: change.y } : {}) })))}
            />
          )}
        </section>

        <aside className="space-y-4 rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm">
          <section className="space-y-3 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Validation</p><h3 className="text-sm font-semibold text-slate-900">Current Selection</h3></div>
              {selectedObjectIds.length > 0 && <button type="button" onClick={removeSelectedObjects} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"><Trash2 className="h-4 w-4" />Delete</button>}
            </div>
            <LevelEditorValidationBadgeList messages={[...levelValidationMessages, ...selectedCellValidationMessages, ...selectedObjectValidationMessages]} />
          </section>

          {selectedObject ? (
            <section className="space-y-3">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Object</p><h3 className="text-base font-semibold text-slate-900">{selectedObject.label}</h3><p className="text-sm text-slate-500">Editing world-space placement and gameplay properties.</p></div>
                  {!selectedObject.singleton && <button type="button" onClick={duplicateSelectedObjects} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">Duplicate</button>}
                </div>
              </div>
              {selectedObjectFieldGroups.map((group) => <FieldGroupSection key={group.label} label={group.label} fields={group.fields} values={selectedObject.object} onChange={updateSelectedObjectField} context={{ source, levelData: levelDraft }} idPrefix={`object-${selectedObject.editorId}`} />)}
            </section>
          ) : selectedCell ? (
            <section className="space-y-3">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Cell</p><h3 className="text-base font-semibold text-slate-900">{selectedCell.id}</h3><p className="text-sm text-slate-500">Grid {selectedCell.col}, {selectedCell.row} • {selectedCellObjects.length} object{selectedCellObjects.length === 1 ? '' : 's'} inside</p></div>
                  <button type="button" onClick={deleteSelectedCell} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60" disabled={!canDeleteSelectedCell}>Delete Cell</button>
                </div>
              </div>
              {cellFieldGroups.map((group) => <FieldGroupSection key={group.label} label={group.label} fields={group.fields} values={selectedCell} onChange={updateSelectedCellField} context={{ source, levelData: levelDraft }} idPrefix={`cell-${selectedCell.id}`} />)}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
};

export default AdminLevelEditorPanel;
