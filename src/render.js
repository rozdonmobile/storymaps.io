// Storymaps.io — AGPL-3.0 — see LICENCE for details
// Rendering and state mutations

import { el, DEFAULT_CARD_COLORS, CARD_COLORS, STATUS_OPTIONS, generateId } from '/src/constants.js';
import { createColumnCard, createStoryCard, createStoryColumn, createSliceContainer, createEmptyBackboneRow, createPhantomStep, PHANTOM_BUFFER, renderLegend as uiRenderLegend, getAllTagsInMap } from '/src/ui.js';

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
    updateSelectionUI();
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
// Column Selection & Duplication
// =============================================================================

import { createColumn as _createColumn, createStory as _createStory, createSlice as _createSlice, selection, clearSelection } from '/src/state.js';

export const handleColumnSelection = (columnId, shiftKey, cardInfo = { type: 'step' }) => {
    if (!_isMapEditable()) return;
    if (!window.matchMedia('(hover: hover)').matches) return;

    if (shiftKey && selection.anchorId) {
        const anchorIdx = _state.columns.findIndex(c => c.id === selection.anchorId);
        const targetIdx = _state.columns.findIndex(c => c.id === columnId);
        if (anchorIdx === -1 || targetIdx === -1) return;

        // Extend range to cover existing selection + new target
        const currentIndices = selection.columnIds.map(id => _state.columns.findIndex(c => c.id === id)).filter(i => i !== -1);
        currentIndices.push(anchorIdx, targetIdx);
        const start = Math.min(...currentIndices);
        const end = Math.max(...currentIndices);
        selection.columnIds = _state.columns.slice(start, end + 1).map(c => c.id);

        // Rebuild clickedCards based on anchor card type
        const anchorCard = selection.clickedCards.find(c => c.columnId === selection.anchorId);
        const anchorType = anchorCard?.type || 'step';

        if (anchorType === 'step') {
            // Step mode: every column in range gets a step entry
            selection.clickedCards = selection.columnIds.map(colId => ({ columnId: colId, type: 'step' }));
        } else {
            // Story mode: keep previous clickedCards within range, add new target
            const rangeColIds = new Set(selection.columnIds);
            const kept = selection.clickedCards.filter(c => rangeColIds.has(c.columnId));
            const alreadyPresent = kept.some(c =>
                c.columnId === columnId && c.type === cardInfo.type &&
                (c.type === 'step' || c.storyId === cardInfo.storyId)
            );
            if (!alreadyPresent) {
                kept.push({ columnId, ...cardInfo });
            }
            selection.clickedCards = kept;
        }
    } else {
        if (selection.columnIds.length === 1 && selection.columnIds[0] === columnId) {
            clearSelection();
        } else {
            selection.columnIds = [columnId];
            selection.anchorId = columnId;
            selection.clickedCards = [{ columnId, ...cardInfo }];
        }
    }

    updateSelectionUI();
};

const createSplitButton = (btnClass, modes, onModeChange) => {
    const splitBtn = el('div', 'selection-toolbar-split');
    let activeAction = modes[0].action;
    const mainBtn = el('button', btnClass, { text: modes[0].label });
    mainBtn.addEventListener('click', () => activeAction());
    const arrowBtn = el('button', 'selection-toolbar-split-arrow ' + btnClass + '-arrow', { html: '&#9662;' });
    const dropdown = el('div', 'selection-toolbar-split-menu');

    modes.forEach((mode, i) => {
        const option = el('button', 'selection-toolbar-split-option', { text: mode.label });
        if (mode.action === activeAction) option.classList.add('active');
        option.addEventListener('click', () => {
            activeAction = mode.action;
            mainBtn.textContent = mode.label;
            dropdown.querySelectorAll('.selection-toolbar-split-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            dropdown.classList.remove('visible');
            if (onModeChange) onModeChange(i);
        });
        dropdown.appendChild(option);
    });

    arrowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close any other open split menus
        document.querySelectorAll('.selection-toolbar-split-menu.visible').forEach(m => {
            if (m !== dropdown) m.classList.remove('visible');
        });
        const opening = !dropdown.classList.contains('visible');
        dropdown.classList.toggle('visible');
        if (opening) {
            const close = (ev) => {
                if (!splitBtn.contains(ev.target)) {
                    dropdown.classList.remove('visible');
                    document.removeEventListener('click', close);
                }
            };
            setTimeout(() => document.addEventListener('click', close), 0);
        }
    });
    splitBtn.append(mainBtn, arrowBtn, dropdown);
    return splitBtn;
};

const updateSelectionHighlights = () => {
    document.querySelectorAll('.column-selected').forEach(elem => elem.classList.remove('column-selected'));
    document.querySelectorAll('.card-selected').forEach(elem => elem.classList.remove('card-selected'));

    const allClicksAreSteps = selection.clickedCards.length > 0 && selection.clickedCards.every(c => c.type === 'step');

    for (const card of selection.clickedCards) {
        if (card.type === 'step') {
            const step = _dom.storyMap.querySelector(`.step[data-column-id="${card.columnId}"]`);
            if (step) step.classList.add('column-selected');
        } else if (card.type === 'story' && card.storyId) {
            const storyCard = _dom.storyMap.querySelector(`.story-card[data-story-id="${card.storyId}"]`);
            if (storyCard) storyCard.classList.add('card-selected');
        }
    }

    // Faint column background only when column-level action is active
    if (selection.columnHighlight) {
        for (const colId of selection.columnIds) {
            const step = _dom.storyMap.querySelector(`.step[data-column-id="${colId}"]`);
            if (step) step.classList.add('column-selected');
            _dom.storyMap.querySelectorAll(`.story-column[data-column-id="${colId}"]`).forEach(elem => {
                elem.classList.add('column-selected');
            });
        }
    }
};

export const updateSelectionUI = () => {
    updateSelectionHighlights();

    document.querySelector('.selection-toolbar')?.remove();

    if (selection.columnIds.length > 0 && window.matchMedia('(hover: hover)').matches) {
        const count = selection.columnIds.length;
        const toolbar = el('div', 'selection-toolbar');
        const label = el('span', 'selection-toolbar-label', { text: `${count} column${count > 1 ? 's' : ''} selected` });

        const items = [label];

        if (count === 1) {
            const hint = el('span', 'selection-toolbar-hint', { text: 'Shift+click for more' });
            items.push(hint);
        }

        const s = count > 1 ? 's' : '';
        const onColumnModeChange = (modeIndex) => {
            selection.columnHighlight = modeIndex === 1;
            updateSelectionHighlights();
        };
        items.push(createSplitButton('selection-toolbar-duplicate', [
            { label: `Duplicate Card${s}`, action: duplicateCards },
            { label: `Duplicate Column${s}`, action: duplicateColumns },
        ], onColumnModeChange));

        items.push(createSplitButton('selection-toolbar-delete', [
            { label: `Delete Card${s}`, action: deleteSelectedCards },
            { label: `Delete Column${s}`, action: deleteSelectedColumns },
        ], onColumnModeChange));

        // Detect common color/status across selected cards
        const selectedColors = new Set();
        const selectedStatuses = new Set();
        for (const card of selection.clickedCards) {
            const item = getItemForCard(card);
            if (item) {
                const defaultColor = card.type === 'step' ? DEFAULT_CARD_COLORS.Activities : DEFAULT_CARD_COLORS.story;
                selectedColors.add(item.color || defaultColor);
                selectedStatuses.add(item.status || null);
            }
        }
        const commonColor = selectedColors.size === 1 ? [...selectedColors][0] : undefined;
        const commonStatus = selectedStatuses.size === 1 ? [...selectedStatuses][0] : undefined;

        // Bulk Color button
        const colorGroup = el('div', 'selection-toolbar-dropdown-group');
        const colorBtn = el('button', 'selection-toolbar-action selection-toolbar-color', { text: 'Color' });
        const colorDropdown = el('div', 'selection-toolbar-dropdown');
        const noneColorSwatch = el('button', 'selection-toolbar-color-swatch selection-toolbar-swatch-none', { text: '\u00d7', title: 'None' });
        noneColorSwatch.addEventListener('click', () => { bulkChangeColor(null); colorDropdown.classList.remove('visible'); });
        colorDropdown.appendChild(noneColorSwatch);
        Object.entries(CARD_COLORS).forEach(([name, hex]) => {
            const swatch = el('button', 'selection-toolbar-color-swatch', { title: name });
            swatch.style.backgroundColor = hex;
            if (commonColor === hex) swatch.classList.add('swatch-active');
            swatch.addEventListener('click', () => { bulkChangeColor(hex); colorDropdown.classList.remove('visible'); });
            colorDropdown.appendChild(swatch);
        });
        colorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.selection-toolbar-dropdown.visible').forEach(d => { if (d !== colorDropdown) d.classList.remove('visible'); });
            colorDropdown.classList.toggle('visible');
        });
        colorGroup.append(colorBtn, colorDropdown);
        items.push(colorGroup);

        // Bulk Status button
        const statusGroup = el('div', 'selection-toolbar-dropdown-group');
        const statusBtn = el('button', 'selection-toolbar-action selection-toolbar-status', { text: 'Status' });
        const statusDropdown = el('div', 'selection-toolbar-dropdown');
        const noneStatusSwatch = el('button', 'selection-toolbar-status-swatch selection-toolbar-swatch-none', { text: '\u00d7', title: 'None' });
        if (commonStatus === null) noneStatusSwatch.classList.add('swatch-active');
        noneStatusSwatch.addEventListener('click', () => { bulkChangeStatus(null); statusDropdown.classList.remove('visible'); });
        statusDropdown.appendChild(noneStatusSwatch);
        Object.entries(STATUS_OPTIONS).forEach(([key, { label, color }]) => {
            const swatch = el('button', 'selection-toolbar-status-swatch', { title: label });
            swatch.style.backgroundColor = color;
            if (commonStatus === key) swatch.classList.add('swatch-active');
            swatch.addEventListener('click', () => { bulkChangeStatus(key); statusDropdown.classList.remove('visible'); });
            statusDropdown.appendChild(swatch);
        });
        statusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.selection-toolbar-dropdown.visible').forEach(d => { if (d !== statusDropdown) d.classList.remove('visible'); });
            statusDropdown.classList.toggle('visible');
        });
        statusGroup.append(statusBtn, statusDropdown);
        items.push(statusGroup);

        // Bulk Tags button
        const tagsGroup = el('div', 'selection-toolbar-dropdown-group');
        const tagsBtn = el('button', 'selection-toolbar-action selection-toolbar-tags', { text: 'Tags' });
        const tagsDropdown = el('div', 'selection-toolbar-dropdown selection-toolbar-tags-dropdown');

        const buildTagsDropdown = () => {
            tagsDropdown.innerHTML = '';

            // Collect tags currently on selected cards
            const selectedTags = new Map();
            for (const card of selection.clickedCards) {
                const item = getItemForCard(card);
                if (item?.tags) item.tags.forEach(t => selectedTags.set(t, (selectedTags.get(t) || 0) + 1));
            }
            const totalSelected = selection.clickedCards.length;

            // Show tags already on selection (with remove)
            if (selectedTags.size > 0) {
                const currentSection = el('div', 'selection-toolbar-tags-section');
                for (const [tag, count] of selectedTags) {
                    const row = el('div', 'selection-toolbar-tag-row');
                    const label = el('span', 'selection-toolbar-tag-label', {
                        text: count < totalSelected ? `${tag} (${count})` : tag
                    });
                    const removeBtn = el('button', 'selection-toolbar-tag-remove', { text: '\u00d7', title: 'Remove from selected' });
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        bulkRemoveTag(tag);
                        buildTagsDropdown();
                    });
                    row.append(label, removeBtn);
                    currentSection.appendChild(row);
                }
                tagsDropdown.appendChild(currentSection);
                tagsDropdown.appendChild(el('div', 'selection-toolbar-tags-divider'));
            }

            // Show all map tags to add
            const allTags = getAllTagsInMap().filter(t => !selectedTags.has(t) || selectedTags.get(t) < totalSelected);
            if (allTags.length > 0) {
                const addSection = el('div', 'selection-toolbar-tags-section');
                allTags.forEach(tag => {
                    const btn = el('button', 'selection-toolbar-tag-option', { text: tag });
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        bulkAddTag(tag);
                        buildTagsDropdown();
                    });
                    addSection.appendChild(btn);
                });
                tagsDropdown.appendChild(addSection);
            }

            // Input to add a new tag
            const inputRow = el('div', 'selection-toolbar-tag-input-row');
            const tagInput = el('input', 'selection-toolbar-tag-input');
            tagInput.type = 'text';
            tagInput.placeholder = 'New tag...';
            tagInput.addEventListener('click', (e) => e.stopPropagation());
            tagInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    bulkAddTag(tagInput.value);
                    buildTagsDropdown();
                }
            });
            inputRow.appendChild(tagInput);
            tagsDropdown.appendChild(inputRow);
        };

        tagsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.selection-toolbar-dropdown.visible').forEach(d => { if (d !== tagsDropdown) d.classList.remove('visible'); });
            const opening = !tagsDropdown.classList.contains('visible');
            tagsDropdown.classList.toggle('visible');
            if (opening) {
                buildTagsDropdown();
                requestAnimationFrame(() => tagsDropdown.querySelector('.selection-toolbar-tag-input')?.focus());
            }
        });
        tagsGroup.append(tagsBtn, tagsDropdown);
        items.push(tagsGroup);

        const clearBtn = el('button', 'selection-toolbar-clear', { text: '\u00d7' });
        clearBtn.addEventListener('click', () => {
            clearSelection();
            updateSelectionUI();
        });
        items.push(clearBtn);

        toolbar.append(...items);
        document.body.appendChild(toolbar);
    }
};

export const duplicateColumns = () => {
    if (selection.columnIds.length === 0) return;
    if (!_isMapEditable()) return;

    // Snapshot selected column IDs in state.columns order
    const selectedIds = _state.columns
        .filter(c => selection.columnIds.includes(c.id))
        .map(c => c.id);

    if (selectedIds.length === 0) return;

    _pushUndo();

    const lastSelectedIdx = Math.max(
        ...selectedIds.map(id => _state.columns.findIndex(c => c.id === id))
    );

    // Create spacer column + deep copies
    const spacerCol = { id: generateId(), name: '', color: null, url: null, hidden: true, status: null, tags: [] };
    const newColumns = [spacerCol];
    const idMap = {};

    selectedIds.forEach(oldId => {
        const original = _state.columns.find(c => c.id === oldId);
        const newCol = { ...original, id: generateId(), tags: [...(original.tags || [])] };
        idMap[oldId] = newCol.id;
        newColumns.push(newCol);
    });

    _state.columns.splice(lastSelectedIdx + 1, 0, ...newColumns);

    // Copy stories for each slice
    _state.slices.forEach(slice => {
        slice.stories[spacerCol.id] = [];

        selectedIds.forEach(oldId => {
            const newId = idMap[oldId];
            const originalStories = slice.stories[oldId] || [];
            slice.stories[newId] = originalStories.map(story => ({ ...story, id: generateId(), tags: [...(story.tags || [])] }));
        });
    });

    clearSelection();
    _renderAndSave();

    // Scroll to first new column
    requestAnimationFrame(() => {
        const firstCopiedCol = newColumns[1];
        if (firstCopiedCol) {
            const newStep = _dom.storyMap.querySelector(
                `.step[data-column-id="${firstCopiedCol.id}"], .step-placeholder[data-column-id="${firstCopiedCol.id}"]`
            );
            if (newStep) _scrollElementIntoView(newStep);
        }
    });
};

export const duplicateCards = () => {
    if (selection.clickedCards.length === 0) return;
    if (!_isMapEditable()) return;

    _pushUndo();

    // Group clicked cards by columnId
    const grouped = new Map();
    for (const card of selection.clickedCards) {
        if (!grouped.has(card.columnId)) grouped.set(card.columnId, []);
        grouped.get(card.columnId).push(card);
    }

    const orderedColumnIds = _state.columns
        .map(c => c.id)
        .filter(id => grouped.has(id));

    if (orderedColumnIds.length === 0) return;

    const lastSelectedIdx = Math.max(
        ...orderedColumnIds.map(id => _state.columns.findIndex(c => c.id === id))
    );

    // Create spacer + new columns
    const spacerCol = { id: generateId(), name: '', color: null, url: null, hidden: true, status: null, tags: [] };
    const newColumns = [spacerCol];

    const columnCardMap = new Map(); // newColId -> cards from that group

    orderedColumnIds.forEach(oldId => {
        const cards = grouped.get(oldId);
        const hasStepClick = cards.some(c => c.type === 'step');
        const original = _state.columns.find(c => c.id === oldId);

        const newCol = hasStepClick
            ? { ...original, id: generateId(), tags: [...(original.tags || [])] }
            : { id: generateId(), name: '', color: null, url: null, hidden: true, status: null, tags: [] };

        columnCardMap.set(newCol.id, { oldId, cards });
        newColumns.push(newCol);
    });

    _state.columns.splice(lastSelectedIdx + 1, 0, ...newColumns);

    // Build stories for each slice
    _state.slices.forEach(slice => {
        slice.stories[spacerCol.id] = [];

        for (const newCol of newColumns.slice(1)) {
            const { oldId, cards } = columnCardMap.get(newCol.id);
            const storyClicks = cards.filter(c => c.type === 'story' && c.sliceId === slice.id);

            if (storyClicks.length > 0) {
                const originalStories = slice.stories[oldId] || [];
                slice.stories[newCol.id] = originalStories
                    .filter(s => storyClicks.some(c => c.storyId === s.id))
                    .map(s => ({ ...s, id: generateId(), tags: [...(s.tags || [])] }));
            } else {
                slice.stories[newCol.id] = [];
            }
        }
    });

    clearSelection();
    _renderAndSave();

    // Scroll to first new column
    requestAnimationFrame(() => {
        const firstCopiedCol = newColumns[1];
        if (firstCopiedCol) {
            const newStep = _dom.storyMap.querySelector(
                `.step[data-column-id="${firstCopiedCol.id}"], .step-placeholder[data-column-id="${firstCopiedCol.id}"]`
            );
            if (newStep) _scrollElementIntoView(newStep);
        }
    });
};

export const deleteSelectedColumns = () => {
    if (selection.columnIds.length === 0) return;
    if (!_isMapEditable()) return;

    const selectedIds = _state.columns
        .filter(c => selection.columnIds.includes(c.id))
        .map(c => c.id);

    const remaining = _state.columns.length - selectedIds.length;
    if (remaining < 1) {
        alert('Cannot delete all columns.');
        return;
    }

    const count = selectedIds.length;
    if (!confirm(`Delete ${count} column${count > 1 ? 's' : ''} and all their stories?`)) return;

    _pushUndo();
    _state.columns = _state.columns.filter(c => !selectedIds.includes(c.id));
    _state.slices.forEach(slice => {
        selectedIds.forEach(id => delete slice.stories[id]);
    });

    clearSelection();
    _renderAndSave();
};

export const deleteSelectedCards = () => {
    if (selection.clickedCards.length === 0) return;
    if (!_isMapEditable()) return;

    const stepClicks = selection.clickedCards.filter(c => c.type === 'step');
    const storyClicks = selection.clickedCards.filter(c => c.type === 'story');

    const cardCount = stepClicks.length + storyClicks.length;
    if (cardCount === 0) return;
    if (!confirm(`Delete ${cardCount} card${cardCount > 1 ? 's' : ''}?`)) return;

    _pushUndo();

    // Delete step cards: reset to hidden/empty
    for (const click of stepClicks) {
        const col = _state.columns.find(c => c.id === click.columnId);
        if (col) {
            col.name = '';
            col.color = null;
            col.url = null;
            col.hidden = true;
            col.status = null;
            col.tags = [];
        }
    }

    // Delete story cards
    const storyIds = new Set(storyClicks.map(c => c.storyId));
    _state.slices.forEach(slice => {
        for (const colId of Object.keys(slice.stories)) {
            slice.stories[colId] = slice.stories[colId].filter(s => !storyIds.has(s.id));
        }
    });

    clearSelection();
    _renderAndSave();
};

// =============================================================================
// Bulk Operations
// =============================================================================

const getItemForCard = (card) => {
    if (card.type === 'step') {
        return _state.columns.find(c => c.id === card.columnId);
    } else if (card.type === 'story' && card.storyId) {
        for (const slice of _state.slices) {
            const stories = slice.stories[card.columnId];
            if (stories) {
                const found = stories.find(s => s.id === card.storyId);
                if (found) return found;
            }
        }
    }
    return null;
};

const bulkChangeColor = (color) => {
    if (selection.clickedCards.length === 0) return;
    _pushUndo();
    for (const card of selection.clickedCards) {
        const item = getItemForCard(card);
        if (item) item.color = color;
    }
    _renderAndSave();
};

const bulkChangeStatus = (status) => {
    if (selection.clickedCards.length === 0) return;
    _pushUndo();
    for (const card of selection.clickedCards) {
        const item = getItemForCard(card);
        if (item) item.status = status;
    }
    _renderAndSave();
};

const bulkAddTag = (tag) => {
    if (selection.clickedCards.length === 0 || !tag) return;
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    _pushUndo();
    for (const card of selection.clickedCards) {
        const item = getItemForCard(card);
        if (!item) continue;
        if (!item.tags) item.tags = [];
        if (!item.tags.includes(trimmed)) item.tags.push(trimmed);
    }
    _renderAndSave();
};

const bulkRemoveTag = (tag) => {
    if (selection.clickedCards.length === 0 || !tag) return;
    _pushUndo();
    for (const card of selection.clickedCards) {
        const item = getItemForCard(card);
        if (item?.tags) item.tags = item.tags.filter(t => t !== tag);
    }
    _renderAndSave();
};

// =============================================================================
// State Mutations
// =============================================================================

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

export const addColumnAt = (index, hidden = false) => {
    _pushUndo();
    const column = _createColumn('', null, null, hidden);
    _state.columns.splice(index, 0, column);
    _state.slices.forEach(slice => slice.stories[column.id] = []);
    _renderAndSave();
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
            // Scroll only the label into view to avoid horizontal jump
            const label = sliceElement.querySelector('.slice-label');
            _scrollElementIntoView(label || sliceElement);
            if (separator && label) {
                label.focus();
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
