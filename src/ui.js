// Storymaps.io — AGPL-3.0 — see LICENCE for details
// UI component builders

import { CARD_COLORS, DEFAULT_CARD_COLORS, STATUS_OPTIONS, el, isValidUrl } from '/src/constants.js';

let _state = null;
let _dom = null;
let _isMapEditable = null;
let _pushUndo = null;
let _addStory = null;
let _deleteColumn = null;
let _deleteStory = null;
let _deleteSlice = null;
let _saveToStorage = null;
let _renderAndSave = null;
let _scrollElementIntoView = null;
let _addColumn = null;
let _addSlice = null;
let _materializePhantomColumn = null;

export const PHANTOM_BUFFER = 3;

export const init = ({ state, dom, isMapEditable, pushUndo, addStory, deleteColumn, deleteStory, deleteSlice, saveToStorage, renderAndSave, scrollElementIntoView, addColumn, addSlice, materializePhantomColumn }) => {
    _state = state;
    _dom = dom;
    _isMapEditable = isMapEditable;
    _pushUndo = pushUndo;
    _addStory = addStory;
    _deleteColumn = deleteColumn;
    _deleteStory = deleteStory;
    _deleteSlice = deleteSlice;
    _saveToStorage = saveToStorage;
    _renderAndSave = renderAndSave;
    _scrollElementIntoView = scrollElementIntoView;
    _addColumn = addColumn;
    _addSlice = addSlice;
    _materializePhantomColumn = materializePhantomColumn;
};

export const createDeleteBtn = (onConfirm, message) => {
    const btn = el('button', 'btn-delete', { html: '&#128465;', title: 'Delete', ariaLabel: 'Delete' });
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(message)) onConfirm();
    });
    return btn;
};

// Slice menu with Mark Complete and Delete options
export const createSliceMenu = (slice, onDelete, deleteMessage) => {
    const container = el('div', 'slice-menu');

    const btn = el('button', 'btn-slice-menu', { text: '☰', title: 'Slice options', ariaLabel: 'Slice options menu' });
    const menu = el('div', 'slice-menu-dropdown');

    // Mark as complete / Reopen option
    const completeOption = el('button', 'slice-menu-item');
    if (slice.collapsed) {
        completeOption.innerHTML = '<span class="slice-menu-icon">↩</span> Reopen';
        completeOption.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSliceCollapsed(slice.id, false);
            menu.classList.remove('visible');
        });
    } else {
        completeOption.innerHTML = '<span class="slice-menu-icon">✓</span> Mark Complete';
        completeOption.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSliceCollapsed(slice.id, true);
            menu.classList.remove('visible');
        });
    }
    menu.appendChild(completeOption);

    // Delete option
    const deleteOption = el('button', 'slice-menu-item slice-menu-item-danger');
    deleteOption.innerHTML = '<span class="slice-menu-icon">🗑</span> Delete';
    deleteOption.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.remove('visible');
        if (confirm(deleteMessage)) onDelete();
    });
    menu.appendChild(deleteOption);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other menus
        document.querySelectorAll('.slice-menu-dropdown.visible').forEach(m => {
            if (m !== menu) m.classList.remove('visible');
        });
        menu.classList.toggle('visible');
    });

    container.appendChild(btn);
    container.appendChild(menu);
    return container;
};

// Toggle slice collapsed state
const toggleSliceCollapsed = (sliceId, collapsed) => {
    const slice = _state.slices.find(s => s.id === sliceId);
    if (!slice) return;

    slice.collapsed = collapsed;
    _renderAndSave();
};

export const createOptionsMenu = (item, colors, onDelete, deleteMessage, onColorChange, onUrlChange, onStatusChange = null, onHide = null, onDeleteColumn = null) => {
    const container = el('div', 'card-options');

    const btn = el('button', 'btn-options', { text: '...', title: 'Options', ariaLabel: 'Options menu', ariaHasPopup: 'true', ariaExpanded: 'false' });
    const menu = el('div', 'options-menu');

    // Color option
    const colorOption = el('div', 'options-item options-color');
    colorOption.appendChild(el('span', null, { text: 'Color' }));
    const colorSwatches = el('div', 'color-swatches');
    const itemColor = item.color?.toLowerCase();
    Object.entries(colors).forEach(([name, hex]) => {
        const swatch = el('button', 'color-swatch', { title: name });
        swatch.style.backgroundColor = hex;
        if (itemColor === hex.toLowerCase()) swatch.classList.add('selected');
        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            onColorChange(hex);
            menu.classList.remove('visible');
        });
        colorSwatches.appendChild(swatch);
    });
    colorOption.appendChild(colorSwatches);
    menu.appendChild(colorOption);

    // Status option
    if (onStatusChange) {
        const statusOption = el('div', 'options-item options-status');
        statusOption.appendChild(el('span', null, { text: 'Status' }));
        const statusSwatches = el('div', 'status-swatches');

        const noneSwatch = el('button', 'status-swatch status-none', { title: 'None', text: '×' });
        if (!item.status) noneSwatch.classList.add('selected');
        noneSwatch.addEventListener('click', (e) => {
            e.stopPropagation();
            onStatusChange(null);
            menu.classList.remove('visible');
        });
        statusSwatches.appendChild(noneSwatch);

        Object.entries(STATUS_OPTIONS).forEach(([key, { label, color }]) => {
            const swatch = el('button', 'status-swatch', { title: label });
            swatch.style.backgroundColor = color;
            if (item.status === key) swatch.classList.add('selected');
            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                onStatusChange(key);
                menu.classList.remove('visible');
            });
            statusSwatches.appendChild(swatch);
        });
        statusOption.appendChild(statusSwatches);
        menu.appendChild(statusOption);
    }

    // URL option
    const urlOption = el('button', 'options-item', { text: item.url ? 'Edit URL...' : 'Add URL...' });
    urlOption.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = prompt('Enter URL (https:// or http://):', item.url || '');
        if (url !== null) {
            if (url === '' || isValidUrl(url)) {
                onUrlChange(url);
            } else {
                alert('Invalid URL. Please enter a valid http:// or https:// URL.');
            }
        }
        menu.classList.remove('visible');
    });
    menu.appendChild(urlOption);

    // Hide header option (for steps only)
    if (onHide) {
        const hideOption = el('button', 'options-item', { text: 'Hide Header' });
        hideOption.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.remove('visible');
            onHide();
        });
        menu.appendChild(hideOption);
    }

    // Delete option
    const deleteOption = el('button', 'options-item options-delete', { text: 'Delete' });
    deleteOption.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.remove('visible');
        if (deleteMessage) {
            if (confirm(deleteMessage)) onDelete();
        } else {
            onDelete();
        }
    });
    menu.appendChild(deleteOption);

    // Delete column option (for step cards only)
    if (onDeleteColumn) {
        const deleteColumnOption = el('button', 'options-item options-delete-column', { text: 'Delete Column' });
        deleteColumnOption.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.remove('visible');
            if (confirm('Delete this column and all its stories?')) {
                onDeleteColumn();
            }
        });
        menu.appendChild(deleteColumnOption);
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.options-menu.visible').forEach(m => {
            if (m !== menu) {
                m.classList.remove('visible');
                m.closest('.step, .story-card')?.classList.remove('menu-open');
                m.parentElement?.querySelector('.btn-options')?.setAttribute('aria-expanded', 'false');
            }
        });
        const isOpen = menu.classList.toggle('visible');
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        const card = container.closest('.step, .story-card');
        if (isOpen) {
            card?.classList.add('menu-open');
        } else {
            card?.classList.remove('menu-open');
        }
    });

    container.append(btn, menu);
    return container;
};

export const createUrlIndicator = (url) => {
    if (!isValidUrl(url)) return null;
    const indicator = el('a', 'url-indicator', {
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: url,
        html: '&#127760;' // Globe emoji
    });
    indicator.addEventListener('click', (e) => e.stopPropagation());
    return indicator;
};

export const createTextarea = (className, placeholder, value, onChange) => {
    const isCardText = className === 'step-text' || className === 'story-text';
    const isSliceLabel = className === 'slice-label';
    const textarea = el('textarea', className, { placeholder, value, rows: isCardText ? 1 : (isSliceLabel ? 3 : 2) });

    // Push undo when user starts editing
    textarea.addEventListener('focus', () => _pushUndo());

    if (isCardText) {
        const autoResize = () => {
            textarea.rows = 1;
            const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 18;
            const neededRows = Math.ceil(textarea.scrollHeight / lineHeight);
            textarea.rows = Math.min(Math.max(neededRows, 1), 3);
        };

        textarea.addEventListener('input', (e) => {
            onChange(e.target.value);
            autoResize();
            _saveToStorage();
        });

        requestAnimationFrame(autoResize);
    } else {
        textarea.addEventListener('input', (e) => {
            onChange(e.target.value);
            _saveToStorage();
        });
    }

    return textarea;
};

const createColumnPlaceholder = (column) => {
    const placeholder = el('div', 'step-placeholder', { dataColumnId: column.id, title: 'Click to show step' });

    placeholder.addEventListener('click', () => {
        column.hidden = false;
        _renderAndSave();
    });

    return placeholder;
};

export const createPhantomStep = (phantomIndex) => {
    const phantom = el('div', 'step-placeholder phantom-step', { title: 'Click to add a step' });
    phantom.addEventListener('click', () => {
        const col = _materializePhantomColumn(phantomIndex);
        if (col) {
            requestAnimationFrame(() => {
                const newStep = _dom.storyMap.querySelector(`[data-column-id="${col.id}"]`);
                if (newStep) {
                    _scrollElementIntoView(newStep);
                    newStep.querySelector('.step-text')?.focus();
                }
            });
        }
    });
    return phantom;
};

export const createPhantomStoryColumn = (phantomIndex, slice, insertIndex) => {
    const phantom = el('div', 'story-column phantom-column empty-backbone-column');
    phantom.addEventListener('click', () => {
        const col = _materializePhantomColumn(phantomIndex);
        if (col) {
            if (slice) {
                _addStory(col.id, slice.id);
            } else if (insertIndex !== undefined) {
                const newSlice = _addSlice(insertIndex, false, phantom.dataset.rowType || null);
                _addStory(col.id, newSlice.id);
            }
        }
    });
    return phantom;
};

export const createColumnCard = (column) => {
    if (column.hidden) {
        return createColumnPlaceholder(column);
    }

    const card = el('div', 'step', { dataColumnId: column.id });
    if (column.color) card.style.backgroundColor = column.color;

    const dragHandle = el('div', 'step-drag-handle', { html: '↔', title: 'Drag to move entire column' });
    card.appendChild(dragHandle);

    const textarea = createTextarea('step-text', 'Step...', column.name,
        (val) => column.name = val);

    const optionsMenu = createOptionsMenu(
        column,
        CARD_COLORS,
        () => {
            column.hidden = true;
            _renderAndSave();
        },
        `Delete "${column.name || 'this step'}"?`,
        (color) => {
            column.color = color;
            _renderAndSave();
        },
        (url) => {
            column.url = url || null;
            _renderAndSave();
        },
        (status) => {
            column.status = status;
            _renderAndSave();
        },
        null, // onHide - not used for step cards (Delete already hides)
        () => _deleteColumn(column.id)
    );

    card.append(textarea, optionsMenu);

    const urlIndicator = createUrlIndicator(column.url);
    if (urlIndicator) card.appendChild(urlIndicator);

    if (column.status && STATUS_OPTIONS[column.status]) {
        const statusIndicator = el('div', 'status-indicator', { title: STATUS_OPTIONS[column.status].label });
        statusIndicator.style.backgroundColor = STATUS_OPTIONS[column.status].color;
        card.appendChild(statusIndicator);
    }

    return card;
};

export const createStoryCard = (story, columnId, sliceId, isBackboneRow = false, rowType = null) => {
    const card = el('div', 'story-card', {
        dataStoryId: story.id,
        dataColumnId: columnId,
        dataSliceId: sliceId
    });
    if (story.color) card.style.backgroundColor = story.color;

    let placeholderText = 'Task or Detail...';
    if (rowType === 'Users') {
        placeholderText = 'e.g. admin, customer, client';
    } else if (isBackboneRow) {
        placeholderText = 'Card...';
    }
    const textarea = createTextarea('story-text', placeholderText, story.name,
        (val) => story.name = val);

    const onDelete = () => _deleteStory(columnId, sliceId, story.id);
    const deleteMessage = isBackboneRow
        ? `Delete "${story.name || 'this card'}"?`
        : `Delete "${story.name || 'this task'}"?`;

    const optionsMenu = createOptionsMenu(
        story,
        CARD_COLORS,
        onDelete,
        deleteMessage,
        (color) => {
            story.color = color;
            _renderAndSave();
        },
        (url) => {
            story.url = url || null;
            _renderAndSave();
        },
        (status) => {
            story.status = status;
            _renderAndSave();
        },
        null, // onHide - not used
        isBackboneRow ? () => _deleteColumn(columnId) : null
    );

    card.append(textarea, optionsMenu);

    const urlIndicator = createUrlIndicator(story.url);
    if (urlIndicator) card.appendChild(urlIndicator);

    if (story.status && STATUS_OPTIONS[story.status]) {
        const statusIndicator = el('div', 'status-indicator', { title: STATUS_OPTIONS[story.status].label });
        statusIndicator.style.backgroundColor = STATUS_OPTIONS[story.status].color;
        card.appendChild(statusIndicator);
    }

    return card;
};

export const createStoryColumn = (col, slice) => {
    const columnEl = el('div', 'story-column', {
        dataColumnId: col.id,
        dataSliceId: slice.id
    });

    const isBackboneRow = slice.separator === false;

    if (!slice.stories[col.id]) slice.stories[col.id] = [];

    slice.stories[col.id].forEach(story => {
        columnEl.appendChild(createStoryCard(story, col.id, slice.id, isBackboneRow, slice.rowType));
    });

    // For backbone rows with no cards, make column clickable to add a card
    if (isBackboneRow && slice.stories[col.id].length === 0) {
        columnEl.classList.add('empty-backbone-column');
        columnEl.addEventListener('click', (e) => {
            if (e.target === columnEl) {
                _addStory(col.id, slice.id);
            }
        });
    }

    const hasCards = slice.stories[col.id].length > 0;
    if ((!isBackboneRow || hasCards) && slice.rowType !== 'Activities') {
        let btnText = '+';
        if (hasCards && slice.rowType === 'Users') btnText = '+ user';
        const addBtn = el('button', 'btn-add-story', { text: btnText });
        addBtn.addEventListener('click', () => _addStory(col.id, slice.id));
        columnEl.appendChild(addBtn);
    }

    return columnEl;
};

export const createEmptyBackboneRow = (rowType, insertIndex) => {
    const containerClass = rowType === 'Users' ? 'users-row empty-backbone-row' :
                           rowType === 'Activities' ? 'activities-row empty-backbone-row' :
                           'backbone-row empty-backbone-row';
    const container = el('div', containerClass);

    const labelContainer = el('div', 'row-label-container');
    const label = el('span', 'row-type-label', { text: rowType });
    labelContainer.appendChild(label);
    container.appendChild(labelContainer);

    const storiesArea = el('div', 'slice-stories-area');
    const storiesRow = el('div', 'stories-row');

    _state.columns.forEach(col => {
        const columnEl = el('div', 'story-column empty-backbone-column', {
            dataColumnId: col.id
        });
        columnEl.addEventListener('click', () => {
            const newSlice = _addSlice(insertIndex, false, rowType);
            _addStory(col.id, newSlice.id);
        });
        storiesRow.appendChild(columnEl);
    });

    for (let i = 0; i < PHANTOM_BUFFER; i++) {
        const phantom = createPhantomStoryColumn(i, null, insertIndex);
        phantom.dataset.rowType = rowType;
        storiesRow.appendChild(phantom);
    }

    storiesArea.appendChild(storiesRow);
    container.appendChild(storiesArea);

    return container;
};

// Calculate progress for a slice (% of tasks marked done)
const getSliceProgress = (slice) => {
    let total = 0;
    let done = 0;
    Object.values(slice.stories || {}).forEach(stories => {
        stories.forEach(story => {
            if (!story.color || story.color === DEFAULT_CARD_COLORS.story) {
                total++;
                if (story.status === 'done') done++;
            }
        });
    });
    return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
};

export const createSliceContainer = (slice, index) => {
    let containerClass = 'slice-container';
    if (slice.separator === false) {
        containerClass = slice.rowType === 'Users' ? 'users-row' :
                         slice.rowType === 'Activities' ? 'activities-row' :
                         'backbone-row';
    }
    if (slice.collapsed) {
        containerClass += ' slice-collapsed';
    }
    const container = el('div', containerClass, { dataSliceId: slice.id });

    if (slice.separator !== false) {
        const labelContainer = el('div', 'slice-label-container', { dataSliceId: slice.id });

        if (slice.collapsed) {
            const controlsRow = el('div', 'slice-controls-row');
            const dragHandle = el('div', 'slice-drag-handle', { html: '↕', title: 'Drag to reorder' });
            controlsRow.appendChild(dragHandle);

            if (_state.slices.length > 1) {
                controlsRow.appendChild(createSliceMenu(slice, () => _deleteSlice(slice.id),
                    `Delete "${slice.name || 'this slice'}" and all its stories?`));
            }
            labelContainer.appendChild(controlsRow);
            container.appendChild(labelContainer);

            const storiesArea = el('div', 'slice-stories-area');
            const storiesRow = el('div', 'stories-row slice-completed-row');

            _state.columns.forEach(() => {
                const placeholder = el('div', 'story-column collapsed-column-placeholder');
                storiesRow.appendChild(placeholder);
            });

            for (let i = 0; i < PHANTOM_BUFFER; i++) {
                const placeholder = el('div', 'story-column collapsed-column-placeholder');
                storiesRow.appendChild(placeholder);
            }

            const completedBanner = el('div', 'slice-completed-banner');
            const sliceName = slice.name ? `${slice.name} - ` : '';
            const bannerText = el('span', 'slice-completed-text', { text: `${sliceName}Complete` });
            completedBanner.appendChild(bannerText);
            storiesRow.appendChild(completedBanner);

            storiesArea.appendChild(storiesRow);
            container.appendChild(storiesArea);

            return container;
        }

        const labelInput = createTextarea('slice-label', 'Release...', slice.name,
            (val) => slice.name = val);
        labelContainer.appendChild(labelInput);

        const progress = getSliceProgress(slice);
        if (progress.total > 0) {
            const progressContainer = el('div', 'slice-progress', {
                title: `${progress.percent}% complete`
            });
            const progressTrack = el('div', 'slice-progress-track');
            const progressBar = el('div', 'slice-progress-bar');
            progressBar.style.width = `${progress.percent}%`;
            progressTrack.appendChild(progressBar);
            progressContainer.appendChild(progressTrack);
            const progressText = el('span', 'slice-progress-text', {
                text: `${progress.done}/${progress.total}`
            });
            progressContainer.appendChild(progressText);
            labelContainer.appendChild(progressContainer);
        }

        const controlsRow = el('div', 'slice-controls-row');
        const dragHandle = el('div', 'slice-drag-handle', { html: '↕', title: 'Drag to reorder' });
        controlsRow.appendChild(dragHandle);

        if (_state.slices.length > 1) {
            controlsRow.appendChild(createSliceMenu(slice, () => _deleteSlice(slice.id),
                `Delete "${slice.name || 'this slice'}" and all its stories?`));
        }
        labelContainer.appendChild(controlsRow);

        const addSliceBtn = el('button', 'btn-add-slice', { text: '+ Slice' });
        addSliceBtn.addEventListener('click', () => _addSlice(index + 1, true));
        labelContainer.appendChild(addSliceBtn);

        container.appendChild(labelContainer);
    } else {
        const labelContainer = el('div', 'row-label-container');

        if (slice.rowType) {
            const label = el('span', 'row-type-label', { text: slice.rowType });
            labelContainer.appendChild(label);
        }

        if (slice.rowType !== 'Users' && slice.rowType !== 'Activities') {
            const deleteBtn = createDeleteBtn(
                () => _deleteSlice(slice.id),
                `Delete the ${slice.rowType || 'row'} row and all its cards?`
            );
            labelContainer.appendChild(deleteBtn);
        }

        container.appendChild(labelContainer);
    }

    const storiesArea = el('div', 'slice-stories-area');
    const storiesRow = el('div', 'stories-row');

    _state.columns.forEach(col => {
        storiesRow.appendChild(createStoryColumn(col, slice));
    });

    for (let i = 0; i < PHANTOM_BUFFER; i++) {
        storiesRow.appendChild(createPhantomStoryColumn(i, slice));
    }
    storiesArea.appendChild(storiesRow);

    container.appendChild(storiesArea);
    return container;
};

// =============================================================================
// Legend
// =============================================================================

export const renderLegend = () => {
    if (!_dom.legendEntries) return;
    _dom.legendEntries.innerHTML = '';
    const editable = _isMapEditable();

    _state.legend.forEach(entry => {
        const row = el('div', 'legend-entry', { 'data-legend-id': entry.id });

        const swatch = el('button', 'legend-swatch', { title: 'Change color' });
        swatch.style.backgroundColor = entry.color;
        if (editable) {
            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                showLegendColorPicker(entry, swatch);
            });
        }
        row.appendChild(swatch);

        const input = el('input', 'legend-label');
        input.type = 'text';
        input.value = entry.label;
        input.placeholder = 'Label...';
        input.readOnly = !editable;
        if (editable) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur();
                }
            });
            input.addEventListener('blur', () => {
                if (entry.label !== input.value) {
                    _pushUndo();
                    entry.label = input.value;
                    _saveToStorage();
                }
            });
        }
        row.appendChild(input);

        if (editable) {
            const removeBtn = el('button', 'legend-remove', { text: '\u00d7', title: 'Remove' });
            removeBtn.addEventListener('click', () => {
                _pushUndo();
                _state.legend = _state.legend.filter(e => e.id !== entry.id);
                _renderAndSave();
            });
            row.appendChild(removeBtn);
        }

        _dom.legendEntries.appendChild(row);
    });

    const maxReached = _state.legend.length >= Object.keys(CARD_COLORS).length;
    _dom.legendAddBtn.style.display = editable && !maxReached ? '' : 'none';
    _dom.legendPanel.classList.toggle('has-entries', _state.legend.length > 0);
    _dom.legendToggle.disabled = !editable && _state.legend.length === 0;
    if (_dom.legendToggle.disabled) _dom.legendPanel.classList.remove('open');
};

const showLegendColorPicker = (entry, anchorEl) => {
    document.querySelector('.legend-color-picker')?.remove();

    const picker = el('div', 'legend-color-picker');
    const swatches = el('div', 'color-swatches');
    Object.entries(CARD_COLORS).forEach(([name, hex]) => {
        const swatch = el('button', 'color-swatch', { title: name });
        swatch.style.backgroundColor = hex;
        if (entry.color?.toLowerCase() === hex.toLowerCase()) swatch.classList.add('selected');
        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            _pushUndo();
            entry.color = hex;
            _renderAndSave();
            picker.remove();
        });
        swatches.appendChild(swatch);
    });
    picker.appendChild(swatches);

    _dom.legendBody.appendChild(picker);

    const close = (e) => {
        if (!picker.contains(e.target) && e.target !== anchorEl) {
            picker.remove();
            document.removeEventListener('click', close);
        }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
};
