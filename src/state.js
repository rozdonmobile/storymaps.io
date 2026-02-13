// Storymaps.io — AGPL-3.0 — see LICENCE for details
// State management, undo/redo, and factory functions

import { generateId, CARD_COLORS } from '/src/constants.js';

export const state = {
    mapId: null,
    name: '',
    columns: [],
    slices: [],
    legend: [],
    notes: ''
};

// Ephemeral selection state (not serialized, not synced, not in undo)
export const selection = { columnIds: [], anchorId: null, clickedCards: [], columnHighlight: false };
export const clearSelection = () => { selection.columnIds = []; selection.anchorId = null; selection.clickedCards = []; selection.columnHighlight = false; };

// Undo/Redo stack (in-memory, lost on refresh)
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 50;

// Callbacks set via init()
let _dom = null;
let _serialize = null;
let _deserialize = null;
let _renderAndSave = null;

export const init = ({ dom, serialize, deserialize, renderAndSave }) => {
    _dom = dom;
    _serialize = serialize;
    _deserialize = deserialize;
    _renderAndSave = renderAndSave;
};

export const pushUndo = () => {
    undoStack.push(JSON.stringify(_serialize()));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0; // Clear redo on new action
    updateUndoRedoButtons();
};

export const undo = () => {
    if (undoStack.length === 0) return;
    const beforeState = _serialize();
    redoStack.push(JSON.stringify(beforeState));
    const previous = JSON.parse(undoStack.pop());
    const changes = findChangedPositions(beforeState, previous);
    _deserialize(previous);
    _dom.boardName.value = state.name;
    _renderAndSave();
    highlightChangedElements(changes);
    updateUndoRedoButtons();
};

export const redo = () => {
    if (redoStack.length === 0) return;
    const beforeState = _serialize();
    undoStack.push(JSON.stringify(beforeState));
    const next = JSON.parse(redoStack.pop());
    const changes = findChangedPositions(beforeState, next);
    _deserialize(next);
    _dom.boardName.value = state.name;
    _renderAndSave();
    highlightChangedElements(changes);
    updateUndoRedoButtons();
};

export const updateUndoRedoButtons = () => {
    if (_dom?.undoBtn) _dom.undoBtn.disabled = undoStack.length === 0;
    if (_dom?.redoBtn) _dom.redoBtn.disabled = redoStack.length === 0;
};

// Compare two serialized states and return positions of changed elements
const findChangedPositions = (before, after) => {
    const changes = { columns: [], stories: [], sliceNames: [] };

    // Compare columns (steps)
    const maxCols = Math.max(before.a?.length || 0, after.a?.length || 0);
    for (let i = 0; i < maxCols; i++) {
        const bCol = before.a?.[i];
        const aCol = after.a?.[i];
        if (JSON.stringify(bCol) !== JSON.stringify(aCol)) {
            changes.columns.push(i);
        }
    }

    // Compare slices and stories
    const maxSlices = Math.max(before.s?.length || 0, after.s?.length || 0);
    for (let si = 0; si < maxSlices; si++) {
        const bSlice = before.s?.[si];
        const aSlice = after.s?.[si];

        // Check slice name
        if ((bSlice?.n || '') !== (aSlice?.n || '')) {
            changes.sliceNames.push(si);
        }

        // Compare stories in each column
        for (let ci = 0; ci < maxCols; ci++) {
            const bStories = bSlice?.t?.[ci] || [];
            const aStories = aSlice?.t?.[ci] || [];
            const maxStories = Math.max(bStories.length, aStories.length);

            for (let sti = 0; sti < maxStories; sti++) {
                if (JSON.stringify(bStories[sti]) !== JSON.stringify(aStories[sti])) {
                    changes.stories.push({ slice: si, col: ci, story: sti });
                }
            }
        }
    }

    return changes;
};

// Apply highlight to changed elements after render
const highlightChangedElements = (changes) => {
    // Highlight changed columns (steps row)
    changes.columns.forEach(colIdx => {
        const col = state.columns[colIdx];
        if (col) {
            const step = _dom.storyMap.querySelector(`.step[data-column-id="${col.id}"]`);
            if (step) step.classList.add('undo-highlight');
        }
    });

    // Highlight changed stories
    changes.stories.forEach(({ slice: sliceIdx, col: colIdx, story: storyIdx }) => {
        const slice = state.slices[sliceIdx];
        const col = state.columns[colIdx];
        if (!slice || !col) return;

        const sliceContainer = _dom.storyMap.querySelector(`[data-slice-id="${slice.id}"]`);
        if (!sliceContainer) return;

        const column = sliceContainer.querySelector(`.story-column[data-column-id="${col.id}"]`);
        if (!column) return;

        const card = column.querySelectorAll('.story-card')[storyIdx];
        if (card) card.classList.add('undo-highlight');
    });

    // Highlight changed slice names (only for release slices with labels)
    changes.sliceNames.forEach(sliceIdx => {
        const slice = state.slices[sliceIdx];
        if (!slice) return;

        const label = _dom.storyMap.querySelector(`.slice-label-container[data-slice-id="${slice.id}"]`);
        if (label) label.classList.add('undo-highlight');
    });

    // Remove highlight class after animation completes
    setTimeout(() => {
        _dom.storyMap.querySelectorAll('.undo-highlight').forEach(el => {
            el.classList.remove('undo-highlight');
        });
    }, 1600);
};

export const initState = () => {
    const column = createColumn('New Step', CARD_COLORS.green, null, false);
    state.name = '';
    state.columns = [column];
    state.legend = [
        { id: generateId(), color: CARD_COLORS.yellow, label: 'Tasks' },
        { id: generateId(), color: CARD_COLORS.cyan, label: 'Notes' },
        { id: generateId(), color: CARD_COLORS.lime, label: 'Questions' },
        { id: generateId(), color: CARD_COLORS.rose, label: 'Edge cases' },
    ];
    state.notes = '';
    state.slices = [
        { id: generateId(), name: '', separator: false, rowType: 'Users', stories: { [column.id]: [createStory('User Type', '#fca5a5')] } },
        { id: generateId(), name: '', separator: false, rowType: 'Activities', stories: { [column.id]: [createStory('New Activity', '#93c5fd')] } },
        { id: generateId(), name: '', separator: true, rowType: null, stories: { [column.id]: [createStory('New Task or Detail', '#fef08a')] } }
    ];
};

export const hasContent = () => {
    if (state.name) return true;
    if (state.columns.some(s => s.name)) return true;
    if (state.slices.some(s => s.name)) return true;
    for (const slice of state.slices) {
        for (const stories of Object.values(slice.stories)) {
            if (stories.length > 0) return true;
        }
    }
    return false;
};

export const confirmOverwrite = () => {
    return !hasContent() || confirm('This will replace your current story map. Continue?');
};

export const createColumn = (name = '', color = null, url = null, hidden = false, status = null, points = null, tags = []) => ({ id: generateId(), name, color, url, hidden, status, points, tags });
export const createStory = (name = '', color = null, url = null, hidden = false, status = null, points = null, tags = []) => ({ id: generateId(), name, color, url, hidden, status, points, tags });
export const createSlice = (name = '', separator = true, rowType = null) => {
    const slice = { id: generateId(), name, separator, rowType, stories: {} };
    state.columns.forEach(s => slice.stories[s.id] = []);
    return slice;
};
