// Storymaps.io — AGPL-3.0 — see LICENCE for details
// Rendering and state mutations

import { el, DEFAULT_CARD_COLORS } from '/src/constants.js';
import { createColumnCard, createStoryCard, createStoryColumn, createSliceContainer, createEmptyBackboneRow, createPhantomStep, PHANTOM_BUFFER, renderLegend as uiRenderLegend } from '/src/ui.js';

let _state = null;
let _dom = null;
let _isMapEditable = null;
let _pushUndo = null;
let _saveToStorage = null;
let _renderAndSave = null;
let _ensureSortable = null;
let _scrollElementIntoView = null;
let _notepadUpdate = null;
let _getIsSafari = null;
let _zoomLevelGetter = null;
let _broadcastDragStart = null;
let _broadcastDragEnd = null;

export const init = ({ state, dom, isMapEditable, pushUndo, saveToStorage, renderAndSave, ensureSortable, scrollElementIntoView, notepadUpdate, getIsSafari, getZoomLevel, broadcastDragStart, broadcastDragEnd }) => {
    _state = state;
    _dom = dom;
    _isMapEditable = isMapEditable;
    _pushUndo = pushUndo;
    _saveToStorage = saveToStorage;
    _renderAndSave = renderAndSave;
    _ensureSortable = ensureSortable;
    _scrollElementIntoView = scrollElementIntoView;
    _notepadUpdate = notepadUpdate;
    _getIsSafari = getIsSafari;
    _zoomLevelGetter = getZoomLevel;
    _broadcastDragStart = broadcastDragStart;
    _broadcastDragEnd = broadcastDragEnd;
};

// =============================================================================
// Rendering
// =============================================================================

export const render = () => {
    // Save focused textarea before clearing DOM
    let savedFocus = null;
    const active = document.activeElement;
    if (active && active.tagName === 'TEXTAREA') {
        const card = active.closest('.story-card');
        const step = active.closest('.step');
        const sliceLabel = active.closest('.slice-label-container');

        if (card && card.dataset.storyId) {
            savedFocus = {
                selector: `.story-card[data-story-id="${card.dataset.storyId}"] .story-text`,
                selStart: active.selectionStart || 0,
                selEnd: active.selectionEnd || 0
            };
        } else if (step && step.dataset.columnId) {
            savedFocus = {
                selector: `.step[data-column-id="${step.dataset.columnId}"] .step-text`,
                selStart: active.selectionStart || 0,
                selEnd: active.selectionEnd || 0
            };
        } else if (sliceLabel && sliceLabel.dataset.sliceId) {
            savedFocus = {
                selector: `.slice-label-container[data-slice-id="${sliceLabel.dataset.sliceId}"] .slice-label`,
                selStart: active.selectionStart || 0,
                selEnd: active.selectionEnd || 0
            };
        }
    }

    // Preserve scroll position across DOM rebuild
    const savedScrollLeft = _dom.storyMapWrapper.scrollLeft;
    const savedScrollTop = _dom.storyMapWrapper.scrollTop;

    _dom.storyMap.innerHTML = '';

    // Separate backbone rows (Users, Activities) from release slices
    const rows = [];
    const slices = [];
    _state.slices.forEach((slice, index) => {
        if (slice.separator === false) {
            rows.push({ slice, index });
        } else {
            slices.push({ slice, index });
        }
    });

    // Find specific row types
    const usersRow = rows.find(r => r.slice.rowType === 'Users');
    const activitiesRow = rows.find(r => r.slice.rowType === 'Activities');

    // Render Users row (or empty placeholder)
    if (usersRow) {
        _dom.storyMap.appendChild(createSliceContainer(usersRow.slice, usersRow.index));
    } else {
        _dom.storyMap.appendChild(createEmptyBackboneRow('Users', 0));
    }

    // Render Activities row (or empty placeholder)
    if (activitiesRow) {
        _dom.storyMap.appendChild(createSliceContainer(activitiesRow.slice, activitiesRow.index));
    } else {
        const idx = usersRow ? usersRow.index + 1 : 0;
        _dom.storyMap.appendChild(createEmptyBackboneRow('Activities', idx));
    }

    // Render any other backbone rows (non-Users, non-Activities)
    rows.filter(r => r.slice.rowType !== 'Users' && r.slice.rowType !== 'Activities')
        .forEach(({ slice, index }) => {
            _dom.storyMap.appendChild(createSliceContainer(slice, index));
        });

    // Steps row (the backbone)
    const stepsRow = el('div', 'steps-row');
    const stepsLabel = el('div', 'steps-row-spacer');
    stepsLabel.appendChild(el('span', 'row-type-label', { text: 'Steps' }));
    stepsRow.appendChild(stepsLabel);

    _state.columns.forEach(col => {
        stepsRow.appendChild(createColumnCard(col));
    });

    for (let i = 0; i < PHANTOM_BUFFER; i++) {
        stepsRow.appendChild(createPhantomStep(i));
    }

    _dom.storyMap.appendChild(stepsRow);

    // Slices (releases) - render below steps
    slices.forEach(({ slice, index }) => {
        _dom.storyMap.appendChild(createSliceContainer(slice, index));
    });

    // Restore scroll position
    _dom.storyMapWrapper.scrollLeft = savedScrollLeft;
    _dom.storyMapWrapper.scrollTop = savedScrollTop;

    // Initialize Sortable for drag and drop
    initSortable();

    // Restore focus if user was editing
    if (savedFocus) {
        const textarea = _dom.storyMap.querySelector(savedFocus.selector);
        if (textarea) {
            textarea.focus();
            const len = textarea.value.length;
            const selStart = Math.min(savedFocus.selStart, len);
            const selEnd = Math.min(savedFocus.selEnd, len);
            textarea.setSelectionRange(selStart, selEnd);
        }
    }

    uiRenderLegend();
    _notepadUpdate();
};

// Store Sortable instances to destroy on re-render
let sortableInstances = [];

export const initSortable = async () => {
    const Sortable = await _ensureSortable();

    // Destroy previous instances
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];

    // Don't enable drag-drop if map is locked
    if (!_isMapEditable()) {
        return;
    }

    const isSafari = _getIsSafari();

    // Make story cards sortable within and between columns
    document.querySelectorAll('.story-column:not(.phantom-column)').forEach(column => {
        const sortable = Sortable.create(column, {
            group: 'stories',
            animation: 150,
            forceFallback: true,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            filter: '.btn-add-story',
            onStart: (evt) => {
                if (_broadcastDragStart) {
                    const storyId = evt.item.dataset.storyId;
                    const sliceId = evt.from.dataset.sliceId;
                    const columnId = evt.from.dataset.columnId;
                    const slice = _state.slices.find(s => s.id === sliceId);
                    const story = slice?.stories[columnId]?.find(s => s.id === storyId);
                    _broadcastDragStart({ type: 'story', storyId, color: story?.color || '#fef08a' });
                }
            },
            onEnd: (evt) => {
                if (_broadcastDragEnd) _broadcastDragEnd();
                const storyId = evt.item.dataset.storyId;
                const fromColumnId = evt.from.dataset.columnId;
                const fromSliceId = evt.from.dataset.sliceId;
                const toColumnId = evt.to.dataset.columnId;
                const toSliceId = evt.to.dataset.sliceId;
                const toIndex = evt.newIndex;

                if (fromColumnId !== toColumnId || fromSliceId !== toSliceId || evt.oldIndex !== evt.newIndex) {
                    moveStory(storyId, fromColumnId, fromSliceId, toColumnId, toSliceId, toIndex);
                }
            }
        });
        sortableInstances.push(sortable);
    });

    // Make release slices sortable (not backbone rows)
    const sliceContainers = document.querySelectorAll('.slice-container');
    if (sliceContainers.length > 0) {
        const sortable = Sortable.create(_dom.storyMap, {
            animation: 150,
            handle: '.slice-drag-handle',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            draggable: '.slice-container',
            onEnd: () => {
                const sliceContainers = _dom.storyMap.querySelectorAll('.slice-container');
                const releaseSlices = _state.slices.filter(s => s.separator !== false);

                const newSliceOrder = [...sliceContainers].map(el =>
                    releaseSlices.find(s => s.id === el.dataset.sliceId)
                ).filter(Boolean);

                const orderChanged = newSliceOrder.some((slice, i) => slice.id !== releaseSlices[i]?.id);
                if (!orderChanged) return;

                let releaseIndex = 0;
                const newSlices = _state.slices.map(s => {
                    if (s.separator === false) {
                        return s;
                    } else {
                        return newSliceOrder[releaseIndex++];
                    }
                });

                _pushUndo();
                _state.slices = newSlices;
                _renderAndSave();
            }
        });
        sortableInstances.push(sortable);
    }

    // Make steps (columns) sortable - moves entire column
    const stepsRow = document.querySelector('.steps-row');
    if (stepsRow) {
        let isDragging = false;
        let dragColumnId = null;
        let columnStartX = new Map();
        let animFrame = null;

        const captureStartPositions = () => {
            columnStartX.clear();
            _state.columns.forEach(col => {
                const firstStoryCol = document.querySelector(`.story-column[data-column-id="${col.id}"]`);
                if (firstStoryCol) {
                    columnStartX.set(col.id, firstStoryCol.getBoundingClientRect().left);
                }
            });
        };

        const updateColumnPositions = () => {
            if (!isDragging) return;

            stepsRow.querySelectorAll('.step').forEach(step => {
                const columnId = step.dataset.columnId;
                const startX = columnStartX.get(columnId);
                if (startX === undefined) return;

                const stepRect = step.getBoundingClientRect();
                const deltaX = stepRect.left - startX;

                document.querySelectorAll(`.story-column[data-column-id="${columnId}"]`).forEach(el => {
                    el.style.transform = `translateX(${deltaX}px)`;
                });
            });

            animFrame = requestAnimationFrame(updateColumnPositions);
        };

        const sortable = Sortable.create(stepsRow, {
            animation: 150,
            forceFallback: true,
            handle: '.step-drag-handle',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            draggable: '.step',
            filter: '.steps-row-spacer, .phantom-step',
            onStart: (evt) => {
                isDragging = true;
                dragColumnId = evt.item.dataset.columnId;
                captureStartPositions();

                if (_broadcastDragStart) {
                    const col = _state.columns.find(c => c.id === dragColumnId);
                    _broadcastDragStart({ type: 'column', columnId: dragColumnId, color: col?.color || '#86efac' });
                }

                evt.item.classList.add('column-being-dragged');
                document.querySelectorAll(`.story-column[data-column-id="${dragColumnId}"] .story-card`).forEach(card => {
                    card.classList.add('column-being-dragged');
                });

                animFrame = requestAnimationFrame(updateColumnPositions);
            },
            onEnd: () => {
                if (_broadcastDragEnd) _broadcastDragEnd();
                isDragging = false;

                if (animFrame) {
                    cancelAnimationFrame(animFrame);
                    animFrame = null;
                }

                document.querySelectorAll('.story-column').forEach(el => {
                    el.style.transform = '';
                });
                document.querySelectorAll('.column-being-dragged').forEach(el => {
                    el.classList.remove('column-being-dragged');
                });

                const stepElements = stepsRow.querySelectorAll('.step, .step-placeholder');
                const newOrder = [...stepElements].map(el =>
                    _state.columns.find(c => c.id === el.dataset.columnId)
                ).filter(Boolean);

                const orderChanged = newOrder.some((col, i) => col.id !== _state.columns[i]?.id);
                if (!orderChanged) {
                    dragColumnId = null;
                    return;
                }

                _pushUndo();
                _state.columns = newOrder;
                dragColumnId = null;
                _renderAndSave();
            }
        });
        sortableInstances.push(sortable);
    }
};

// =============================================================================
// State Mutations
// =============================================================================

import { createColumn as _createColumn, createStory as _createStory, createSlice as _createSlice } from '/src/state.js';

const focusLastElement = (selector, textareaClass) => {
    const elements = _dom.storyMap.querySelectorAll(selector);
    const last = elements[elements.length - 1];
    if (last) {
        _scrollElementIntoView(last);
        last.querySelector(textareaClass)?.focus();
    }
};

export const addColumn = (hidden = true) => {
    _pushUndo();
    const column = _createColumn('', null, null, hidden);
    _state.columns.push(column);
    _state.slices.forEach(slice => slice.stories[column.id] = []);
    _renderAndSave();

    requestAnimationFrame(() => {
        const newStep = _dom.storyMap.querySelector(`[data-column-id="${column.id}"]`);
        if (newStep) {
            _scrollElementIntoView(newStep);
            if (!hidden) {
                newStep.querySelector('.step-text')?.focus();
            }
        }
    });
};

export const addStory = (columnId, sliceId) => {
    const slice = _state.slices.find(s => s.id === sliceId);
    if (!slice) return;

    _pushUndo();

    slice.stories[columnId] = slice.stories[columnId] || [];

    const color = DEFAULT_CARD_COLORS[slice.rowType] || DEFAULT_CARD_COLORS.story;

    slice.stories[columnId].push(_createStory('', color));
    _renderAndSave();

    const storyIndex = slice.stories[columnId].length - 1;
    requestAnimationFrame(() => {
        const column = _dom.storyMap.querySelector(
            `.story-column[data-column-id="${columnId}"][data-slice-id="${sliceId}"]`
        );
        const newCard = column?.querySelectorAll('.story-card')[storyIndex];
        if (newCard) {
            _scrollElementIntoView(newCard);
            newCard.querySelector('.story-text')?.focus();
        }
    });
};

export const addSlice = (afterIndex, separator = true, rowType = null) => {
    _pushUndo();
    const slice = _createSlice('', separator, rowType);
    _state.slices.splice(afterIndex, 0, slice);
    _renderAndSave();

    requestAnimationFrame(() => {
        const sliceElement = _dom.storyMap.querySelector(`[data-slice-id="${slice.id}"]`);
        if (sliceElement) {
            _scrollElementIntoView(sliceElement);
            if (separator) {
                sliceElement.querySelector('.slice-label')?.focus();
            }
        }
    });
    return slice;
};

export const deleteColumn = (columnId) => {
    if (_state.columns.length <= 1) {
        alert('Cannot delete the last column.');
        return;
    }
    const index = _state.columns.findIndex(s => s.id === columnId);
    if (index === -1) return;

    _pushUndo();
    _state.columns.splice(index, 1);
    _state.slices.forEach(slice => delete slice.stories[columnId]);
    _renderAndSave();
};

export const deleteStory = (columnId, sliceId, storyId) => {
    const slice = _state.slices.find(s => s.id === sliceId);
    const stories = slice?.stories[columnId];
    if (!stories) return;

    const index = stories.findIndex(s => s.id === storyId);
    if (index > -1) {
        _pushUndo();
        stories.splice(index, 1);
        _renderAndSave();
    }
};

export const moveStory = (storyId, fromColumnId, fromSliceId, toColumnId, toSliceId, toIndex) => {
    _pushUndo();
    const fromSlice = _state.slices.find(s => s.id === fromSliceId);
    const toSlice = _state.slices.find(s => s.id === toSliceId);
    if (!fromSlice || !toSlice) return;

    const fromStories = fromSlice.stories[fromColumnId];
    if (!fromStories) return;

    const storyIndex = fromStories.findIndex(s => s.id === storyId);
    if (storyIndex === -1) return;

    const [story] = fromStories.splice(storyIndex, 1);

    if (!toSlice.stories[toColumnId]) toSlice.stories[toColumnId] = [];

    toSlice.stories[toColumnId].splice(toIndex, 0, story);
    _renderAndSave();
};

export const deleteSlice = (sliceId) => {
    if (_state.slices.length <= 1) return;

    const index = _state.slices.findIndex(s => s.id === sliceId);
    if (index > -1) {
        _pushUndo();
        _state.slices.splice(index, 1);
        _renderAndSave();
    }
};
