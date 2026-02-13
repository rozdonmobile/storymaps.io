// Storymaps.io — AGPL-3.0 — see LICENCE for details
// Orchestrator — imports all modules, wires init(), owns dom + persistence + event listeners

import * as notepad from '/src/notepad.js';
import { generateId, el, CARD_COLORS, STATUS_OPTIONS, ZOOM_LEVELS } from '/src/constants.js';
import { state, init as stateInit, initState, hasContent, confirmOverwrite, pushUndo, undo, redo, updateUndoRedoButtons, createColumn, createStory, createSlice, selection, clearSelection } from '/src/state.js';
import { serialize, deserialize } from '/src/serialization.js';
import * as navigation from '/src/navigation.js';
import * as presence from '/src/presence.js';
import * as lock from '/src/lock.js';
import * as yjs from '/src/yjs.js';
import * as ui from '/src/ui.js';
import * as renderMod from '/src/render.js';
import * as exportsMod from '/src/exports.js';

// =============================================================================
// DOM References
// =============================================================================

const dom = {
    logoLink: document.getElementById('logoLink'),
    storyMap: document.getElementById('storyMap'),
    boardName: document.getElementById('boardName'),
    newMapBtn: document.getElementById('newMapBtn'),
    copyExistingBtn: document.getElementById('copyExistingBtn'),
    importBtn: document.getElementById('importMap'),
    exportBtn: document.getElementById('exportMap'),
    printBtn: document.getElementById('printMap'),
    menuBtn: document.getElementById('menuBtn'),
    mainMenu: document.getElementById('mainMenu'),
    zoomIn: document.getElementById('zoomIn'),
    zoomOut: document.getElementById('zoomOut'),
    zoomReset: document.getElementById('zoomReset'),
    undoBtn: document.getElementById('undoBtn'),
    redoBtn: document.getElementById('redoBtn'),
    shareBtn: document.getElementById('shareBtn'),
    shareMenu: document.getElementById('shareMenu'),
    shareCopyLink: document.getElementById('shareCopyLink'),
    shareScreenshot: document.getElementById('shareScreenshot'),
    shareDownload: document.getElementById('shareDownload'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    welcomeNewBtn: document.getElementById('welcomeNewBtn'),
    welcomeCounter: document.getElementById('welcomeCounter'),
    storyMapWrapper: document.getElementById('storyMapWrapper'),
    samplesSubmenuTrigger: document.getElementById('samplesSubmenuTrigger'),
    samplesSubmenu: document.getElementById('samplesSubmenu'),
    exportSubmenuTrigger: document.getElementById('exportSubmenuTrigger'),
    exportSubmenu: document.getElementById('exportSubmenu'),
    zoomControls: document.getElementById('zoomControls'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    tutorialToast: document.getElementById('tutorialToast'),
    tutorialToastClose: document.getElementById('tutorialToastClose'),
    importModal: document.getElementById('importModal'),
    importModalClose: document.getElementById('importModalClose'),
    importJsonText: document.getElementById('importJsonText'),
    importJsonBtn: document.getElementById('importJsonBtn'),
    importDropzone: document.getElementById('importDropzone'),
    importFileInput: document.getElementById('importFileInput'),
    exportModal: document.getElementById('exportModal'),
    exportModalClose: document.getElementById('exportModalClose'),
    exportJsonText: document.getElementById('exportJsonText'),
    exportMinify: document.getElementById('exportMinify'),
    exportCopyBtn: document.getElementById('exportCopyBtn'),
    exportFilename: document.getElementById('exportFilename'),
    exportDownloadBtn: document.getElementById('exportDownloadBtn'),
    // Jira export
    exportJiraBtn: document.getElementById('exportJiraBtn'),
    jiraExportModal: document.getElementById('jiraExportModal'),
    jiraExportModalClose: document.getElementById('jiraExportModalClose'),
    jiraProjectName: document.getElementById('jiraProjectName'),
    jiraProjectKey: document.getElementById('jiraProjectKey'),
    jiraProjectType: document.getElementById('jiraProjectType'),
    jiraExportSlices: document.getElementById('jiraExportSlices'),
    jiraExportEpics: document.getElementById('jiraExportEpics'),
    jiraExportCount: document.getElementById('jiraExportCount'),
    jiraExportCancel: document.getElementById('jiraExportCancel'),
    jiraExportDownload: document.getElementById('jiraExportDownload'),
    jiraStatusNone: document.getElementById('jiraStatusNone'),
    jiraStatusDone: document.getElementById('jiraStatusDone'),
    jiraStatusInProgress: document.getElementById('jiraStatusInProgress'),
    jiraStatusPlanned: document.getElementById('jiraStatusPlanned'),
    jiraFilterNone: document.getElementById('jiraFilterNone'),
    jiraFilterPlanned: document.getElementById('jiraFilterPlanned'),
    jiraFilterInProgress: document.getElementById('jiraFilterInProgress'),
    jiraFilterDone: document.getElementById('jiraFilterDone'),
    // Phabricator export
    exportPhabBtn: document.getElementById('exportPhabBtn'),
    phabExportModal: document.getElementById('phabExportModal'),
    phabExportModalClose: document.getElementById('phabExportModalClose'),
    phabExportTitle: document.getElementById('phabExportTitle'),
    phabStage1: document.getElementById('phabStage1'),
    phabStage2: document.getElementById('phabStage2'),
    phabExportSlices: document.getElementById('phabExportSlices'),
    phabExportEpics: document.getElementById('phabExportEpics'),
    phabExportCount: document.getElementById('phabExportCount'),
    phabFilterNone: document.getElementById('phabFilterNone'),
    phabFilterPlanned: document.getElementById('phabFilterPlanned'),
    phabFilterInProgress: document.getElementById('phabFilterInProgress'),
    phabFilterDone: document.getElementById('phabFilterDone'),
    phabExportCancel: document.getElementById('phabExportCancel'),
    phabExportNext: document.getElementById('phabExportNext'),
    phabExportBack: document.getElementById('phabExportBack'),
    phabExportDone: document.getElementById('phabExportDone'),
    phabInstanceUrl: document.getElementById('phabInstanceUrl'),
    phabApiToken: document.getElementById('phabApiToken'),
    phabTags: document.getElementById('phabTags'),
    phabImportFunction: document.getElementById('phabImportFunction'),
    phabImportCall: document.getElementById('phabImportCall'),
    phabCopyFunction: document.getElementById('phabCopyFunction'),
    phabCopyCall: document.getElementById('phabCopyCall'),
    // Jira API export
    exportJiraApiBtn: document.getElementById('exportJiraApiBtn'),
    jiraApiExportModal: document.getElementById('jiraApiExportModal'),
    jiraApiExportModalClose: document.getElementById('jiraApiExportModalClose'),
    jiraApiExportTitle: document.getElementById('jiraApiExportTitle'),
    jiraApiStage1: document.getElementById('jiraApiStage1'),
    jiraApiStage2: document.getElementById('jiraApiStage2'),
    jiraApiExportSlices: document.getElementById('jiraApiExportSlices'),
    jiraApiExportEpics: document.getElementById('jiraApiExportEpics'),
    jiraApiExportCount: document.getElementById('jiraApiExportCount'),
    jiraApiFilterNone: document.getElementById('jiraApiFilterNone'),
    jiraApiFilterPlanned: document.getElementById('jiraApiFilterPlanned'),
    jiraApiFilterInProgress: document.getElementById('jiraApiFilterInProgress'),
    jiraApiFilterDone: document.getElementById('jiraApiFilterDone'),
    jiraApiExportCancel: document.getElementById('jiraApiExportCancel'),
    jiraApiExportNext: document.getElementById('jiraApiExportNext'),
    jiraApiExportBack: document.getElementById('jiraApiExportBack'),
    jiraApiExportDone: document.getElementById('jiraApiExportDone'),
    jiraApiEmail: document.getElementById('jiraApiEmail'),
    jiraApiToken: document.getElementById('jiraApiToken'),
    jiraApiProjectKey: document.getElementById('jiraApiProjectKey'),
    jiraApiImportFunction: document.getElementById('jiraApiImportFunction'),
    jiraApiImportCall: document.getElementById('jiraApiImportCall'),
    jiraApiCopyFunction: document.getElementById('jiraApiCopyFunction'),
    jiraApiCopyCall: document.getElementById('jiraApiCopyCall'),
    // Asana export
    exportAsanaBtn: document.getElementById('exportAsanaBtn'),
    asanaExportModal: document.getElementById('asanaExportModal'),
    asanaExportModalClose: document.getElementById('asanaExportModalClose'),
    asanaExportTitle: document.getElementById('asanaExportTitle'),
    asanaStage1: document.getElementById('asanaStage1'),
    asanaStage2: document.getElementById('asanaStage2'),
    asanaExportSlices: document.getElementById('asanaExportSlices'),
    asanaExportEpics: document.getElementById('asanaExportEpics'),
    asanaExportCount: document.getElementById('asanaExportCount'),
    asanaFilterNone: document.getElementById('asanaFilterNone'),
    asanaFilterPlanned: document.getElementById('asanaFilterPlanned'),
    asanaFilterInProgress: document.getElementById('asanaFilterInProgress'),
    asanaFilterDone: document.getElementById('asanaFilterDone'),
    asanaExportCancel: document.getElementById('asanaExportCancel'),
    asanaExportNext: document.getElementById('asanaExportNext'),
    asanaExportBack: document.getElementById('asanaExportBack'),
    asanaExportDone: document.getElementById('asanaExportDone'),
    asanaApiToken: document.getElementById('asanaApiToken'),
    asanaProjectUrl: document.getElementById('asanaProjectUrl'),
    asanaImportFunction: document.getElementById('asanaImportFunction'),
    asanaImportCall: document.getElementById('asanaImportCall'),
    asanaCreateSections: document.getElementById('asanaCreateSections'),
    asanaCopyFunction: document.getElementById('asanaCopyFunction'),
    asanaCopyCall: document.getElementById('asanaCopyCall'),
    // Asana CSV export
    exportAsanaCsvBtn: document.getElementById('exportAsanaCsvBtn'),
    asanaCsvExportModal: document.getElementById('asanaCsvExportModal'),
    asanaCsvExportModalClose: document.getElementById('asanaCsvExportModalClose'),
    asanaCsvExportSlices: document.getElementById('asanaCsvExportSlices'),
    asanaCsvExportEpics: document.getElementById('asanaCsvExportEpics'),
    asanaCsvExportCount: document.getElementById('asanaCsvExportCount'),
    asanaCsvFilterNone: document.getElementById('asanaCsvFilterNone'),
    asanaCsvFilterPlanned: document.getElementById('asanaCsvFilterPlanned'),
    asanaCsvFilterInProgress: document.getElementById('asanaCsvFilterInProgress'),
    asanaCsvFilterDone: document.getElementById('asanaCsvFilterDone'),
    asanaCsvCreateSections: document.getElementById('asanaCsvCreateSections'),
    asanaCsvExportCancel: document.getElementById('asanaCsvExportCancel'),
    asanaCsvExportDownload: document.getElementById('asanaCsvExportDownload'),
    // Cursor toggle
    toggleCursorsBtn: document.getElementById('toggleCursorsBtn'),
    toggleCursorsText: document.getElementById('toggleCursorsText'),
    // Lock feature
    lockMapBtn: document.getElementById('lockMapBtn'),
    relockBtn: document.getElementById('relockBtn'),
    updatePasswordBtn: document.getElementById('updatePasswordBtn'),
    removeLockBtn: document.getElementById('removeLockBtn'),
    lockDivider: document.getElementById('lockDivider'),
    lockModal: document.getElementById('lockModal'),
    lockModalTitle: document.getElementById('lockModalTitle'),
    lockModalDescription: document.getElementById('lockModalDescription'),
    lockModalClose: document.getElementById('lockModalClose'),
    lockPasswordInput: document.getElementById('lockPasswordInput'),
    lockModalCancel: document.getElementById('lockModalCancel'),
    lockModalConfirm: document.getElementById('lockModalConfirm'),
    readOnlyBanner: document.getElementById('readOnlyBanner'),
    legendPanel: document.getElementById('legendPanel'),
    legendToggle: document.getElementById('legendToggle'),
    legendBody: document.getElementById('legendBody'),
    legendEntries: document.getElementById('legendEntries'),
    legendAddBtn: document.getElementById('legendAddBtn'),
    controlsRight: document.getElementById('controlsRight'),
    // Search
    searchBtn: document.getElementById('searchBtn'),
    searchBar: document.getElementById('searchBar'),
    searchInput: document.getElementById('searchInput'),
    searchClose: document.getElementById('searchClose'),
    // Filter
    searchFilterBtn: document.getElementById('searchFilterBtn'),
    filterCount: document.getElementById('filterCount'),
    filterPanel: document.getElementById('filterPanel'),
    filterStatusList: document.getElementById('filterStatusList'),
    filterColorList: document.getElementById('filterColorList'),
    filterTagsList: document.getElementById('filterTagsList'),
    filterClearBtn: document.getElementById('filterClearBtn'),
};

const { isMapEditable } = lock;
const { render, initSortable, addColumn, addColumnAt, addStory, addSlice, deleteColumn, deleteStory, deleteSlice, handleColumnSelection, updateSelectionUI, duplicateColumns, duplicateCards, deleteSelectedColumns, deleteSelectedCards } = renderMod;
const { closeMainMenu, closeAllOptionsMenus, zoomToFit, scrollElementIntoView } = navigation;
const { loadYjs, createYjsDoc, destroyYjs, syncFromYjs, syncToYjs, getProvider, getYdoc, getYmap, ensureSortable } = yjs;
const { trackPresence, clearPresence, trackCursor, clearCursors, toggleCursorsVisibility, updateCursorsVisibilityUI, getCursorColor, getSessionId, broadcastDragStart, broadcastDragEnd } = presence;
const { lockState, loadLockState, subscribeLockState, clearLockSubscription, updateLockUI, updateEditability, checkSessionUnlock, initLockListeners, hideLockModal } = lock;
const { renderLegend, getAllTagsInMap } = ui;

// =============================================================================
// Persistence
// =============================================================================

const STORAGE_KEY = 'storymap';

// Generate a unique map ID, checking server-side SQLite for collisions
const newMapId = async () => {
    try {
        const res = await fetch('/api/maps/new-id');
        if (res.ok) return (await res.json()).id;
    } catch { /* fall through */ }
    return generateId();
};

// Subscribe to real-time updates via Yjs
const subscribeToMap = async (mapId) => {
    if (!getYdoc()) {
        await createYjsDoc(mapId);
    }

    syncFromYjs();
    render();

    const deferredTracking = async () => {
        trackPresence();
        trackCursor();
        await loadLockState(mapId);
        lockState.sessionUnlocked = checkSessionUnlock(mapId);
        subscribeLockState(mapId);
        updateLockUI();
        updateEditability();

        const provider = getProvider();
        if (provider) {
            provider.awareness.on('change', () => {
                const ydoc = getYdoc();
                for (const [clientId, awarenessState] of provider.awareness.getStates()) {
                    if (clientId === ydoc.clientID) continue;
                    if (awarenessState.lock) {
                        loadLockState(mapId).then(() => {
                            lockState.sessionUnlocked = checkSessionUnlock(mapId);
                            updateLockUI();
                            updateEditability();
                        });
                        break;
                    }
                }
            });
        }
    };
    if ('requestIdleCallback' in window) {
        requestIdleCallback(deferredTracking);
    } else {
        setTimeout(deferredTracking, 0);
    }
};

// Local storage save (also syncs to Yjs → WebSocket → server)
const saveToStorage = () => {
    if (state.mapId && !isMapEditable()) {
        return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()));
    if (state.mapId && getYmap()) {
        syncToYjs();
    }
};

// Combined render and save - used after state mutations
const renderAndSave = () => {
    render();
    saveToStorage();
};

const loadFromStorage = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        try {
            deserialize(JSON.parse(data));
            return true;
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
    }
    return false;
};

// =============================================================================
// Import / Export
// =============================================================================

const exportMap = () => {
    if (dom.welcomeScreen.classList.contains('visible')) return;
    saveToStorage();
    showExportModal();
};

const importMap = (file) => {
    const isFromWelcome = !state.mapId;

    if (!isFromWelcome) {
        saveToStorage();
        if (!confirmOverwrite()) return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            if (isFromWelcome) {
                hideWelcomeScreen();
                initState();
                const mapId = await newMapId();
                state.mapId = mapId;
                history.replaceState({ mapId }, '', `/${mapId}`);
                await createYjsDoc(mapId);
            } else {
                pushUndo();
            }
            deserialize(JSON.parse(e.target.result));
            dom.boardName.value = state.name;
            renderAndSave();
            requestAnimationFrame(zoomToFit);
            if (isFromWelcome) {
                subscribeToMap(state.mapId);
            }
        } catch {
            alert('Failed to import: Invalid file format');
        }
    };
    reader.readAsText(file);
};

const showImportModal = () => {
    dom.importModal.classList.add('visible');
    dom.importJsonText.value = '';
    dom.importJsonText.focus();
};

const hideImportModal = () => {
    dom.importModal.classList.remove('visible');
    dom.importJsonText.value = '';
};

const importFromJsonText = async (jsonText) => {
    const isFromWelcome = !state.mapId;

    if (!isFromWelcome) {
        saveToStorage();
        if (!confirmOverwrite()) return;
    }

    try {
        const data = JSON.parse(jsonText);
        if (isFromWelcome) {
            hideWelcomeScreen();
            initState();
            const mapId = await newMapId();
            state.mapId = mapId;
            history.replaceState({ mapId }, '', `/${mapId}`);
            await createYjsDoc(mapId);
        } else {
            pushUndo();
        }
        deserialize(data);
        dom.boardName.value = state.name;
        renderAndSave();
        requestAnimationFrame(zoomToFit);
        hideImportModal();
        if (isFromWelcome) {
            subscribeToMap(state.mapId);
        }
    } catch {
        alert('Failed to import: Invalid JSON format');
    }
};

const updateExportJson = () => {
    const minify = dom.exportMinify.checked;
    const json = minify ? JSON.stringify(serialize()) : JSON.stringify(serialize(), null, 2);
    dom.exportJsonText.value = json;
};

const sanitizeFilename = (name) => {
    return name
        .toLowerCase()
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
        .replace(/^\.+/, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 200)
        || 'story-map';
};
exportsMod.init({ dom, sanitizeFilename });
const {
    showJiraExportModal, hideJiraExportModal, confirmCloseJiraExportModal, populateJiraExportEpics, downloadJiraCsv, jiraExportState,
    showPhabExportModal, hidePhabExportModal, confirmClosePhabModal, populatePhabExportEpics, showPhabStage2, showPhabStage1,
    generatePhabImportFunction, generatePhabImportCall, copyPhabCode, phabExportState,
    showJiraApiExportModal, hideJiraApiExportModal, confirmCloseJiraApiModal, populateJiraApiExportEpics,
    showJiraApiStage2, showJiraApiStage1, generateJiraApiImportCall, jiraApiExportState,
    showAsanaExportModal, hideAsanaExportModal, confirmCloseAsanaModal, populateAsanaExportEpics,
    showAsanaStage2, showAsanaStage1, generateAsanaImportCall, asanaExportState,
    showAsanaCsvExportModal, hideAsanaCsvExportModal, confirmCloseAsanaCsvModal,
    populateAsanaCsvExportEpics, downloadAsanaCsv, asanaCsvExportState,
} = exportsMod;

const showExportModal = () => {
    dom.exportModal.classList.add('visible');
    dom.exportFilename.value = sanitizeFilename(state.name || 'story-map');
    dom.exportMinify.checked = false;
    updateExportJson();
};

const hideExportModal = () => {
    dom.exportModal.classList.remove('visible');
};

const copyExportJson = async () => {
    const json = dom.exportJsonText.value;
    try {
        await navigator.clipboard.writeText(json);
        dom.exportCopyBtn.textContent = 'Copied!';
        setTimeout(() => dom.exportCopyBtn.textContent = 'Copy to Clipboard', 2000);
    } catch {
        dom.exportJsonText.select();
        document.execCommand('copy');
        dom.exportCopyBtn.textContent = 'Copied!';
        setTimeout(() => dom.exportCopyBtn.textContent = 'Copy to Clipboard', 2000);
    }
};

const downloadExportFile = () => {
    const filename = sanitizeFilename(dom.exportFilename.value) + '.json';
    const json = dom.exportJsonText.value;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = el('a', null, { href: url, download: filename });
    link.click();
    URL.revokeObjectURL(url);
    hideExportModal();
};

const loadSample = async (name) => {
    if (!state.mapId) {
        return startWithSample(name);
    }

    saveToStorage();
    if (!confirmOverwrite()) return;

    try {
        const response = await fetch(`samples/${name}.json`, { cache: 'no-cache' });
        if (!response.ok) throw new Error();
        pushUndo();
        deserialize(await response.json());
        dom.boardName.value = state.name;
        renderAndSave();
    } catch {
        alert('Failed to load sample');
    }
};

const newMap = async () => {
    saveToStorage();
    if (hasContent() && !confirm('Create a new story map?\n\nYou can return to this map using the back button.')) {
        return;
    }
    destroyYjs();

    state.mapId = null;

    hideWelcomeScreen();

    initState();
    dom.boardName.value = '';
    render();

    const mapId = await newMapId();
    state.mapId = mapId;
    history.pushState({ mapId }, '', `/${mapId}`);

    await createYjsDoc(mapId);
    subscribeToMap(mapId);
    saveToStorage();
    incrementMapCounter();
};

const copyMap = async () => {
    saveToStorage();
    if (!confirm('Copy this map?\n\nA copy will be created with a new URL.')) {
        return;
    }
    destroyYjs();

    const currentName = dom.boardName.value || 'Untitled';
    state.name = `${currentName} (Copy)`;
    dom.boardName.value = state.name;

    const mapId = await newMapId();
    state.mapId = mapId;
    history.pushState({ mapId }, '', `/${mapId}`);

    await createYjsDoc(mapId);
    subscribeToMap(mapId);
    saveToStorage();
    incrementMapCounter();
};

// =============================================================================
// Event Listeners
// =============================================================================

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// =============================================================================
// Search / Filter
// =============================================================================

let searchDebounceTimer = null;
const filterState = { statuses: new Set(), colors: new Set(), tags: new Set() };

const openSearch = () => {
    if (dom.searchBtn.disabled) return;
    dom.searchBar.classList.remove('hidden');
    dom.boardName.style.display = 'none';
    dom.storyMap.classList.add('search-active');
    dom.searchInput.focus();
};

const closeSearch = () => {
    dom.searchBar.classList.add('hidden');
    dom.boardName.style.display = '';
    dom.storyMap.classList.remove('search-active');
    dom.searchInput.value = '';
    closeFilterPanel();
    clearAllFilters();
    clearSearchFilter();
};

const clearSearchFilter = () => {
    dom.storyMap.querySelectorAll('.search-dimmed').forEach(el => el.classList.remove('search-dimmed'));
};

const hasActiveFilters = () => filterState.statuses.size > 0 || filterState.colors.size > 0 || filterState.tags.size > 0;

// Look up the state object for a card element
const getItemForStep = (step) => {
    const colId = step.dataset.columnId;
    return state.columns.find(c => c.id === colId);
};

const getItemForStoryCard = (card) => {
    const storyId = card.dataset.storyId;
    const sliceId = card.dataset.sliceId;
    const colId = card.dataset.columnId;
    const slice = state.slices.find(s => s.id === sliceId);
    return slice?.stories[colId]?.find(s => s.id === storyId);
};

const itemMatchesFilters = (item) => {
    if (!item) return false;
    if (filterState.statuses.size > 0) {
        const itemStatus = item.status || 'none';
        if (!filterState.statuses.has(itemStatus)) return false;
    }
    if (filterState.colors.size > 0) {
        const itemColor = (item.color || '').toLowerCase();
        if (!filterState.colors.has(itemColor)) return false;
    }
    if (filterState.tags.size > 0) {
        const itemTags = item.tags || [];
        if (!itemTags.some(t => filterState.tags.has(t))) return false;
    }
    return true;
};

const applySearchFilter = (query) => {
    clearSearchFilter();
    const q = query?.toLowerCase() || '';
    const filtering = hasActiveFilters();

    if (!q && !filtering) return;

    // Dim non-matching step cards
    dom.storyMap.querySelectorAll('.step').forEach(step => {
        const text = step.querySelector('.step-text')?.value?.toLowerCase() || '';
        const textMatch = !q || text.includes(q);
        const filterMatch = !filtering || itemMatchesFilters(getItemForStep(step));
        if (!textMatch || !filterMatch) step.classList.add('search-dimmed');
    });

    // Dim non-matching story cards
    dom.storyMap.querySelectorAll('.story-card').forEach(card => {
        const text = card.querySelector('.story-text')?.value?.toLowerCase() || '';
        const textMatch = !q || text.includes(q);
        const filterMatch = !filtering || itemMatchesFilters(getItemForStoryCard(card));
        if (!textMatch || !filterMatch) card.classList.add('search-dimmed');
    });
};

// Filter panel
const populateFilterPanel = () => {
    // Status checkboxes
    dom.filterStatusList.innerHTML = '';
    const statusEntries = [['none', 'No Status', '#e5e5e5'], ...Object.entries(STATUS_OPTIONS).map(([k, v]) => [k, v.label, v.color])];
    statusEntries.forEach(([key, label, color]) => {
        const lbl = el('label', 'filter-checkbox');
        const cb = el('input');
        cb.type = 'checkbox';
        cb.checked = filterState.statuses.has(key);
        const dot = el('span', 'filter-status-dot');
        dot.style.backgroundColor = color;
        const text = el('span', null, { text: label });
        cb.addEventListener('change', () => {
            if (cb.checked) filterState.statuses.add(key); else filterState.statuses.delete(key);
            updateFilterCountBadge();
            applySearchFilter(dom.searchInput.value.trim());
        });
        lbl.append(cb, dot, text);
        dom.filterStatusList.appendChild(lbl);
    });

    // Color swatches
    dom.filterColorList.innerHTML = '';
    Object.entries(CARD_COLORS).forEach(([name, hex]) => {
        const swatch = el('button', 'filter-color-swatch', { title: name });
        swatch.style.backgroundColor = hex;
        if (filterState.colors.has(hex.toLowerCase())) swatch.classList.add('selected');
        swatch.addEventListener('click', () => {
            const lc = hex.toLowerCase();
            if (filterState.colors.has(lc)) {
                filterState.colors.delete(lc);
                swatch.classList.remove('selected');
            } else {
                filterState.colors.add(lc);
                swatch.classList.add('selected');
            }
            updateFilterCountBadge();
            applySearchFilter(dom.searchInput.value.trim());
        });
        dom.filterColorList.appendChild(swatch);
    });

    // Tag checkboxes
    dom.filterTagsList.innerHTML = '';
    const allTags = getAllTagsInMap();
    if (allTags.length === 0) {
        dom.filterTagsList.appendChild(el('span', 'filter-empty', { text: 'No tags in map' }));
    } else {
        allTags.forEach(tag => {
            const lbl = el('label', 'filter-checkbox');
            const cb = el('input');
            cb.type = 'checkbox';
            cb.checked = filterState.tags.has(tag);
            const text = el('span', null, { text: tag });
            cb.addEventListener('change', () => {
                if (cb.checked) filterState.tags.add(tag); else filterState.tags.delete(tag);
                updateFilterCountBadge();
                applySearchFilter(dom.searchInput.value.trim());
            });
            lbl.append(cb, text);
            dom.filterTagsList.appendChild(lbl);
        });
    }
};

const openFilterPanel = () => {
    populateFilterPanel();
    dom.filterPanel.classList.remove('hidden');
    dom.searchFilterBtn.classList.add('active');
};

const closeFilterPanel = () => {
    dom.filterPanel.classList.add('hidden');
    dom.searchFilterBtn.classList.remove('active');
};

const toggleFilterPanel = () => {
    if (dom.filterPanel.classList.contains('hidden')) openFilterPanel(); else closeFilterPanel();
};

const updateFilterCountBadge = () => {
    const count = filterState.statuses.size + filterState.colors.size + filterState.tags.size;
    dom.filterCount.textContent = count;
    dom.filterCount.classList.toggle('hidden', count === 0);
    dom.searchFilterBtn.classList.toggle('has-filters', count > 0);
};

const clearAllFilters = () => {
    filterState.statuses.clear();
    filterState.colors.clear();
    filterState.tags.clear();
    updateFilterCountBadge();
    applySearchFilter(dom.searchInput.value.trim());
};

const initEventListeners = () => {
    dom.logoLink.addEventListener('click', (e) => {
        if (!state.mapId) return;
        e.preventDefault();
        if (!hasContent() || confirm('Go to home page?\n\nYou can return to this map using the back button.')) {
            window.location.href = '/';
        }
    });

    dom.welcomeNewBtn.addEventListener('click', startNewMap);

    document.querySelector('.welcome-samples-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-sample');
        if (btn?.dataset.sample) {
            e.stopPropagation();
            startWithSample(btn.dataset.sample);
        }
    });

    window.addEventListener('popstate', async (e) => {
        const mapId = window.location.pathname.slice(1) || null;
        if (mapId) {
            await loadMapById(mapId);
            hideWelcomeScreen();
        } else {
            destroyYjs();
            showWelcomeScreen();
        }
    });

    dom.boardName.addEventListener('input', (e) => {
        state.name = e.target.value;
        saveToStorage();
    });

    dom.boardName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            dom.boardName.blur();
        }
    });

    dom.newMapBtn.addEventListener('click', () => {
        closeMainMenu();
        newMap();
    });
    dom.copyExistingBtn.addEventListener('click', () => {
        closeMainMenu();
        copyMap();
    });
    dom.exportBtn.addEventListener('click', () => {
        closeMainMenu();
        exportMap();
    });
    dom.printBtn.addEventListener('click', () => {
        closeMainMenu();
        const originalTitle = document.title;
        document.title = sanitizeFilename(state.name || 'story-map');
        window.print();
        document.title = originalTitle;
    });
    dom.toggleCursorsBtn?.addEventListener('click', () => {
        closeMainMenu();
        toggleCursorsVisibility();
    });
    dom.importBtn.addEventListener('click', () => {
        closeMainMenu();
        if (lockState.isLocked && !lockState.sessionUnlocked) {
            alert('This map is read-only. Unlock it first to import.');
            return;
        }
        showImportModal();
    });

    // Import modal events
    dom.importModalClose.addEventListener('click', hideImportModal);
    dom.importModal.addEventListener('click', (e) => {
        if (e.target === dom.importModal) hideImportModal();
    });
    dom.importJsonBtn.addEventListener('click', () => {
        const jsonText = dom.importJsonText.value.trim();
        if (jsonText) {
            importFromJsonText(jsonText);
        }
    });
    dom.importJsonText.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            const jsonText = dom.importJsonText.value.trim();
            if (jsonText) {
                importFromJsonText(jsonText);
            }
        }
    });
    dom.importDropzone.addEventListener('click', () => {
        dom.importFileInput.click();
    });
    dom.importFileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            hideImportModal();
            importMap(e.target.files[0]);
            e.target.value = '';
        }
    });
    dom.importDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.importDropzone.classList.add('dragover');
    });
    dom.importDropzone.addEventListener('dragleave', () => {
        dom.importDropzone.classList.remove('dragover');
    });
    dom.importDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.importDropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.json')) {
            hideImportModal();
            importMap(file);
        }
    });

    // Export modal events
    dom.exportModalClose.addEventListener('click', hideExportModal);
    dom.exportModal.addEventListener('click', (e) => {
        if (e.target === dom.exportModal) hideExportModal();
    });
    dom.exportMinify.addEventListener('change', updateExportJson);
    dom.exportCopyBtn.addEventListener('click', copyExportJson);
    dom.exportDownloadBtn.addEventListener('click', downloadExportFile);

    // Jira Export Modal
    dom.exportJiraBtn.addEventListener('click', () => {
        closeMainMenu();
        showJiraExportModal();
    });
    dom.jiraExportModalClose.addEventListener('click', confirmCloseJiraExportModal);
    dom.jiraExportModal.addEventListener('click', (e) => {
        if (e.target === dom.jiraExportModal) confirmCloseJiraExportModal();
    });
    dom.jiraExportCancel.addEventListener('click', confirmCloseJiraExportModal);
    dom.jiraExportDownload.addEventListener('click', () => {
        downloadJiraCsv();
    });
    [dom.jiraStatusNone, dom.jiraStatusPlanned, dom.jiraStatusInProgress, dom.jiraStatusDone].forEach(input => {
        input.addEventListener('input', populateJiraExportEpics);
    });
    const statusFilters = [
        { el: dom.jiraFilterNone, status: 'none' },
        { el: dom.jiraFilterPlanned, status: 'planned' },
        { el: dom.jiraFilterInProgress, status: 'in-progress' },
        { el: dom.jiraFilterDone, status: 'done' }
    ];
    statusFilters.forEach(({ el: checkbox, status }) => {
        checkbox.addEventListener('change', (e) => {
            const label = checkbox.closest('label');
            if (e.target.checked) {
                jiraExportState.selectedStatuses.add(status);
                label.classList.add('checked');
            } else {
                jiraExportState.selectedStatuses.delete(status);
                label.classList.remove('checked');
            }
            populateJiraExportEpics();
        });
    });

    // Phabricator Export Modal
    dom.exportPhabBtn.addEventListener('click', () => {
        if (dom.exportPhabBtn.disabled) return;
        closeMainMenu();
        showPhabExportModal();
    });
    dom.phabExportModalClose.addEventListener('click', confirmClosePhabModal);
    dom.phabExportModal.addEventListener('click', (e) => {
        if (e.target === dom.phabExportModal) confirmClosePhabModal();
    });
    dom.phabExportCancel.addEventListener('click', confirmClosePhabModal);
    dom.phabExportNext.addEventListener('click', showPhabStage2);
    dom.phabExportBack.addEventListener('click', showPhabStage1);
    dom.phabExportDone.addEventListener('click', hidePhabExportModal);
    dom.phabCopyFunction.addEventListener('click', () => {
        copyPhabCode(dom.phabImportFunction, dom.phabCopyFunction);
    });
    dom.phabCopyCall.addEventListener('click', () => {
        copyPhabCode(dom.phabImportCall, dom.phabCopyCall);
    });
    document.getElementById('phabTokenHelpLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('To get your API token:\n\n1. Click your profile picture in Phabricator\n2. Go to Settings\n3. Click "Conduit API Tokens"\n4. Click "Generate Token"');
    });
    dom.phabInstanceUrl.addEventListener('input', () => {
        dom.phabImportFunction.textContent = generatePhabImportFunction();
    });
    dom.phabApiToken.addEventListener('input', () => {
        dom.phabImportCall.textContent = generatePhabImportCall();
    });
    dom.phabTags.addEventListener('input', () => {
        dom.phabImportCall.textContent = generatePhabImportCall();
    });
    const phabStatusFilters = [
        { el: dom.phabFilterNone, status: 'none' },
        { el: dom.phabFilterPlanned, status: 'planned' },
        { el: dom.phabFilterInProgress, status: 'in-progress' },
        { el: dom.phabFilterDone, status: 'done' }
    ];
    phabStatusFilters.forEach(({ el: checkbox, status }) => {
        checkbox.addEventListener('change', (e) => {
            const label = checkbox.closest('label');
            if (e.target.checked) {
                phabExportState.selectedStatuses.add(status);
                label.classList.add('checked');
            } else {
                phabExportState.selectedStatuses.delete(status);
                label.classList.remove('checked');
            }
            populatePhabExportEpics();
        });
    });

    // Jira API Export Modal
    dom.exportJiraApiBtn.addEventListener('click', () => {
        if (dom.exportJiraApiBtn.disabled) return;
        closeMainMenu();
        showJiraApiExportModal();
    });
    dom.jiraApiExportModalClose.addEventListener('click', confirmCloseJiraApiModal);
    dom.jiraApiExportModal.addEventListener('click', (e) => {
        if (e.target === dom.jiraApiExportModal) confirmCloseJiraApiModal();
    });
    dom.jiraApiExportCancel.addEventListener('click', confirmCloseJiraApiModal);
    dom.jiraApiExportNext.addEventListener('click', showJiraApiStage2);
    dom.jiraApiExportBack.addEventListener('click', showJiraApiStage1);
    dom.jiraApiExportDone.addEventListener('click', hideJiraApiExportModal);
    dom.jiraApiCopyFunction.addEventListener('click', () => {
        copyPhabCode(dom.jiraApiImportFunction, dom.jiraApiCopyFunction);
    });
    dom.jiraApiCopyCall.addEventListener('click', () => {
        copyPhabCode(dom.jiraApiImportCall, dom.jiraApiCopyCall);
    });
    dom.jiraApiEmail.addEventListener('input', () => {
        dom.jiraApiImportCall.textContent = generateJiraApiImportCall();
    });
    dom.jiraApiToken.addEventListener('input', () => {
        dom.jiraApiImportCall.textContent = generateJiraApiImportCall();
    });
    dom.jiraApiProjectKey.addEventListener('input', () => {
        dom.jiraApiImportCall.textContent = generateJiraApiImportCall();
    });
    const jiraApiStatusFilters = [
        { el: dom.jiraApiFilterNone, status: 'none' },
        { el: dom.jiraApiFilterPlanned, status: 'planned' },
        { el: dom.jiraApiFilterInProgress, status: 'in-progress' },
        { el: dom.jiraApiFilterDone, status: 'done' }
    ];
    jiraApiStatusFilters.forEach(({ el: checkbox, status }) => {
        checkbox.addEventListener('change', (e) => {
            const label = checkbox.closest('label');
            if (e.target.checked) {
                jiraApiExportState.selectedStatuses.add(status);
                label.classList.add('checked');
            } else {
                jiraApiExportState.selectedStatuses.delete(status);
                label.classList.remove('checked');
            }
            populateJiraApiExportEpics();
        });
    });

    // Asana Export Modal
    dom.exportAsanaBtn.addEventListener('click', () => {
        if (dom.exportAsanaBtn.disabled) return;
        closeMainMenu();
        showAsanaExportModal();
    });
    dom.asanaExportModalClose.addEventListener('click', confirmCloseAsanaModal);
    dom.asanaExportModal.addEventListener('click', (e) => {
        if (e.target === dom.asanaExportModal) confirmCloseAsanaModal();
    });
    dom.asanaExportCancel.addEventListener('click', confirmCloseAsanaModal);
    dom.asanaExportNext.addEventListener('click', showAsanaStage2);
    dom.asanaExportBack.addEventListener('click', showAsanaStage1);
    dom.asanaExportDone.addEventListener('click', hideAsanaExportModal);
    dom.asanaCopyFunction.addEventListener('click', () => {
        copyPhabCode(dom.asanaImportFunction, dom.asanaCopyFunction);
    });
    dom.asanaCopyCall.addEventListener('click', () => {
        copyPhabCode(dom.asanaImportCall, dom.asanaCopyCall);
    });
    dom.asanaApiToken.addEventListener('input', () => {
        dom.asanaImportCall.textContent = generateAsanaImportCall();
    });
    dom.asanaProjectUrl.addEventListener('input', () => {
        dom.asanaImportCall.textContent = generateAsanaImportCall();
    });
    const asanaStatusFilters = [
        { el: dom.asanaFilterNone, status: 'none' },
        { el: dom.asanaFilterPlanned, status: 'planned' },
        { el: dom.asanaFilterInProgress, status: 'in-progress' },
        { el: dom.asanaFilterDone, status: 'done' }
    ];
    asanaStatusFilters.forEach(({ el: checkbox, status }) => {
        checkbox.addEventListener('change', (e) => {
            const label = checkbox.closest('label');
            if (e.target.checked) {
                asanaExportState.selectedStatuses.add(status);
                label.classList.add('checked');
            } else {
                asanaExportState.selectedStatuses.delete(status);
                label.classList.remove('checked');
            }
            populateAsanaExportEpics();
        });
    });

    // Asana CSV Export Modal
    dom.exportAsanaCsvBtn.addEventListener('click', () => {
        if (dom.exportAsanaCsvBtn.disabled) return;
        closeMainMenu();
        showAsanaCsvExportModal();
    });
    dom.asanaCsvExportModalClose.addEventListener('click', confirmCloseAsanaCsvModal);
    dom.asanaCsvExportModal.addEventListener('click', (e) => {
        if (e.target === dom.asanaCsvExportModal) confirmCloseAsanaCsvModal();
    });
    dom.asanaCsvExportCancel.addEventListener('click', confirmCloseAsanaCsvModal);
    dom.asanaCsvExportDownload.addEventListener('click', downloadAsanaCsv);
    const asanaCsvStatusFilters = [
        { el: dom.asanaCsvFilterNone, status: 'none' },
        { el: dom.asanaCsvFilterPlanned, status: 'planned' },
        { el: dom.asanaCsvFilterInProgress, status: 'in-progress' },
        { el: dom.asanaCsvFilterDone, status: 'done' }
    ];
    asanaCsvStatusFilters.forEach(({ el: checkbox, status }) => {
        checkbox.addEventListener('change', (e) => {
            const label = checkbox.closest('label');
            if (e.target.checked) {
                asanaCsvExportState.selectedStatuses.add(status);
                label.classList.add('checked');
            } else {
                asanaCsvExportState.selectedStatuses.delete(status);
                label.classList.remove('checked');
            }
            populateAsanaCsvExportEpics();
        });
    });

    // Share dropdown
    dom.shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMainMenu();
        const onMap = !dom.welcomeScreen.classList.contains('visible');
        dom.shareScreenshot.disabled = !onMap;
        dom.shareDownload.disabled = !onMap;
        dom.shareMenu.classList.toggle('visible');
    });
    dom.shareCopyLink.addEventListener('click', async (e) => {
        e.stopPropagation();
        dom.shareMenu.classList.remove('visible');
        const url = window.location.href;
        try {
            await navigator.clipboard.writeText(url);
            dom.shareBtn.textContent = 'Copied!';
            setTimeout(() => dom.shareBtn.textContent = 'Share', 2000);
        } catch {
            prompt('Copy this link to share:', url);
        }
    });
    const captureMap = async () => {
        if (!window._htmlToImage) {
            const mod = await import('/vendor/html-to-image.bundle.js');
            window._htmlToImage = mod;
        }

        // Capture the map as a canvas (no logo in live DOM — avoids flicker)
        const mapCanvas = await window._htmlToImage.toCanvas(dom.storyMap, {
            backgroundColor: '#f8fafc',
            pixelRatio: 2,
            style: {
                transform: 'none',
                margin: '0',
                minWidth: '0',
                padding: '24px',
            },
        });

        // Capture the logo separately
        const logoCanvas = await window._htmlToImage.toCanvas(dom.logoLink, {
            backgroundColor: 'transparent',
            pixelRatio: 2,
        });

        // Composite: logo on top, then map below with spacing
        const logoPad = 24 * 2; // padding around edges (matches map padding), scaled by pixelRatio
        const logoGap = 60 * 2; // gap between logo and map, scaled by pixelRatio
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = Math.max(mapCanvas.width, logoCanvas.width + logoPad * 2);
        finalCanvas.height = mapCanvas.height + logoCanvas.height + logoGap;
        const ctx = finalCanvas.getContext('2d');
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        ctx.drawImage(logoCanvas, logoPad, logoPad);
        ctx.drawImage(mapCanvas, 0, logoCanvas.height + logoGap);

        return finalCanvas;
    };
    dom.shareScreenshot.addEventListener('click', async (e) => {
        e.stopPropagation();
        dom.shareMenu.classList.remove('visible');
        dom.shareBtn.textContent = 'Capturing...';
        try {
            const canvas = await captureMap();
            const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            dom.shareBtn.textContent = 'Copied!';
            setTimeout(() => dom.shareBtn.textContent = 'Share', 2000);
        } catch (err) {
            alert('Screenshot failed: ' + err.message);
            dom.shareBtn.textContent = 'Share';
        }
    });
    dom.shareDownload.addEventListener('click', async (e) => {
        e.stopPropagation();
        dom.shareMenu.classList.remove('visible');
        dom.shareBtn.textContent = 'Capturing...';
        try {
            const canvas = await captureMap();
            const dataUrl = canvas.toDataURL('image/png');
            const link = el('a', null, {
                href: dataUrl,
                download: sanitizeFilename(state.name || 'story-map') + '.png'
            });
            link.click();
            dom.shareBtn.textContent = 'Share';
        } catch (err) {
            alert('Screenshot failed: ' + err.message);
            dom.shareBtn.textContent = 'Share';
        }
    });

    // Undo/Redo buttons
    dom.undoBtn.addEventListener('click', () => { clearSelection(); undo(); });
    dom.redoBtn.addEventListener('click', () => { clearSelection(); redo(); });

    // Legend controls
    dom.legendToggle?.addEventListener('click', () => {
        dom.legendPanel.classList.toggle('open');
    });
    dom.legendAddBtn?.addEventListener('click', () => {
        if (state.legend.length >= Object.keys(CARD_COLORS).length) return;
        pushUndo();
        state.legend.push({
            id: generateId(),
            color: CARD_COLORS.yellow,
            label: ''
        });
        renderAndSave();
        const inputs = dom.legendEntries.querySelectorAll('.legend-label');
        if (inputs.length) inputs[inputs.length - 1].focus();
    });

    // Search
    dom.searchBtn.addEventListener('click', openSearch);
    dom.searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => applySearchFilter(dom.searchInput.value.trim()), 150);
    });
    dom.searchClose.addEventListener('click', closeSearch);

    // Filter panel
    dom.searchFilterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFilterPanel();
    });
    dom.filterClearBtn.addEventListener('click', () => {
        clearAllFilters();
        populateFilterPanel();
    });
    dom.filterPanel.addEventListener('click', (e) => e.stopPropagation());

    // Zoom controls
    dom.zoomIn.addEventListener('click', navigation.zoomIn);
    dom.zoomOut.addEventListener('click', navigation.zoomOut);
    dom.zoomReset.addEventListener('click', navigation.zoomCycle);

    // Main menu dropdown
    dom.menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.shareMenu.classList.remove('visible');
        dom.mainMenu.classList.toggle('visible');
        document.body.classList.toggle('main-menu-open', dom.mainMenu.classList.contains('visible'));
        const onMap = !dom.welcomeScreen.classList.contains('visible');
        dom.copyExistingBtn.disabled = !onMap;
        dom.exportSubmenuTrigger.disabled = !onMap;
        dom.printBtn.disabled = !onMap;
    });

    // Samples submenu toggle
    dom.samplesSubmenuTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.samplesSubmenuTrigger.classList.toggle('expanded');
        dom.samplesSubmenu.classList.toggle('visible');
        dom.exportSubmenu.classList.remove('visible');
        dom.exportSubmenuTrigger.classList.remove('expanded');
    });

    // Export submenu toggle
    dom.exportSubmenuTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.exportSubmenuTrigger.classList.toggle('expanded');
        dom.exportSubmenu.classList.toggle('visible');
        dom.samplesSubmenu.classList.remove('visible');
        dom.samplesSubmenuTrigger.classList.remove('expanded');
    });

    // Handle clicks on sample items in main menu
    dom.mainMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (item?.dataset.sample) {
            if (lockState.isLocked && !lockState.sessionUnlocked) {
                alert('This map is read-only. Unlock it first to load a sample.');
                closeMainMenu();
                return;
            }
            loadSample(item.dataset.sample);
            closeMainMenu();
        }
    });

    document.addEventListener('click', () => {
        closeMainMenu();
        closeAllOptionsMenus();
        dom.shareMenu.classList.remove('visible');
        closeFilterPanel();
    });

    document.addEventListener('keydown', (e) => {
        const isTextInput = e.target.matches('input, textarea') || e.target.closest('.cm-editor');

        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isTextInput) {
            e.preventDefault();
            clearSelection();
            undo();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !isTextInput) {
            e.preventDefault();
            clearSelection();
            redo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !isTextInput && selection.columnIds.length > 0) {
            e.preventDefault();
            duplicateColumns();
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && !isTextInput && selection.columnIds.length > 0) {
            e.preventDefault();
            const hasStorySelection = selection.clickedCards.some(c => c.type === 'story');
            if (hasStorySelection) {
                deleteSelectedCards();
            } else {
                deleteSelectedColumns();
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            openSearch();
        }
        if (e.key === 'Escape') {
            if (!dom.filterPanel.classList.contains('hidden')) {
                closeFilterPanel();
            } else if (!dom.searchBar.classList.contains('hidden')) {
                closeSearch();
            } else if (selection.columnIds.length > 0) {
                clearSelection();
                updateSelectionUI();
            }
            closeMainMenu();
            closeAllOptionsMenus();
            dom.shareMenu.classList.remove('visible');
            hideImportModal();
            hideExportModal();
            hideJiraExportModal();
            hideJiraApiExportModal();
            hidePhabExportModal();
            hideAsanaExportModal();
            hideAsanaCsvExportModal();
        }
        if (!isTextInput && ((e.altKey && e.key === 'r') || (e.shiftKey && e.code === 'Digit0'))) {
            e.preventDefault();
            zoomToFit();
        }
        if (!isTextInput && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            const PAN_AMOUNT = 100;
            const wrapper = dom.storyMapWrapper;
            switch (e.key) {
                case 'ArrowLeft':
                    wrapper.scrollBy({ left: -PAN_AMOUNT, behavior: 'smooth' });
                    break;
                case 'ArrowRight':
                    wrapper.scrollBy({ left: PAN_AMOUNT, behavior: 'smooth' });
                    break;
                case 'ArrowUp':
                    wrapper.scrollBy({ top: -PAN_AMOUNT, behavior: 'smooth' });
                    break;
                case 'ArrowDown':
                    wrapper.scrollBy({ top: PAN_AMOUNT, behavior: 'smooth' });
                    break;
            }
            e.preventDefault();
        }
    });

    // Pan/drag navigation (right-click to pan, Miro-style)
    navigation.initPan();

    // Marquee (rectangle) selection
    navigation.initMarquee();

    // Ctrl+scroll wheel zoom
    navigation.initWheelZoom();

    // Lock feature event listeners
    initLockListeners();
};

// =============================================================================
// Welcome Screen / Loading
// =============================================================================

let counterLoaded = false;

const setCounterValue = (count) => {
    if (!dom.welcomeCounter) return;
    dom.welcomeCounter.innerHTML = `📊 <span class="count">${count.toLocaleString()}</span> story maps created`;
    dom.welcomeCounter.classList.add('visible');
};

const subscribeToCounter = async () => {
    if (!dom.welcomeCounter || counterLoaded) return;

    const cached = localStorage.getItem('mapCount');
    if (cached) {
        setCounterValue(parseInt(cached));
    }

    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        const count = data.mapCount || 0;
        if (count > 0) {
            localStorage.setItem('mapCount', count);
            setCounterValue(count);
        }
        counterLoaded = true;
    } catch {
        // Silently fail - counter is non-essential
    }
};

const unsubscribeFromCounter = () => {
    counterLoaded = false;
    dom.welcomeCounter?.classList.remove('visible');
};

const incrementMapCounter = async () => {
    try {
        const res = await fetch('/api/stats', { method: 'POST' });
        const data = await res.json();
        localStorage.setItem('mapCount', data.mapCount);
    } catch {
        // Silently fail - counter is non-essential
    }
};

const showWelcomeScreen = () => {
    document.body.classList.add('welcome-visible');
    dom.welcomeScreen.classList.add('visible');
    dom.storyMapWrapper.classList.remove('visible');
    dom.boardName.classList.add('hidden');
    dom.zoomControls.classList.add('hidden');
    dom.controlsRight?.classList.add('hidden');
    dom.searchBtn.disabled = true;
    closeSearch();
    clearPresence();
    clearCursors();
    clearLockSubscription();
    updateLockUI();
    subscribeToCounter();
};

const hideWelcomeScreen = () => {
    document.body.classList.remove('welcome-visible');
    dom.welcomeScreen.classList.remove('visible');
    dom.storyMapWrapper.classList.add('visible');
    dom.boardName.classList.remove('hidden');
    dom.zoomControls.classList.remove('hidden');
    dom.controlsRight?.classList.remove('hidden');
    dom.searchBtn.disabled = false;
    unsubscribeFromCounter();
};

const showLoading = () => {
    dom.loadingIndicator.classList.add('visible');
};

const hideLoading = () => {
    dom.loadingIndicator.classList.remove('visible');
};

const startNewMap = async () => {
    hideWelcomeScreen();
    initState();
    const mapId = await newMapId();
    state.mapId = mapId;
    history.replaceState({ mapId }, '', `/${mapId}`);
    dom.boardName.value = state.name;
    render();
    requestAnimationFrame(zoomToFit);
    setTimeout(showTutorialToast, 800);
    await createYjsDoc(mapId);
    subscribeToMap(mapId);
    saveToStorage();
    incrementMapCounter();
};

const showTutorialToast = () => {
    const isMac = navigator.platform.includes('Mac') || navigator.userAgent.includes('Mac');
    const shortcutEl = dom.tutorialToast.querySelector('.reset-shortcut-key');
    if (isMac && shortcutEl) shortcutEl.textContent = 'Shift + 0';
    dom.tutorialToast.classList.add('visible');
    const dismiss = () => {
        dom.tutorialToast.classList.remove('visible');
        clearTimeout(timer);
    };
    const timer = setTimeout(dismiss, 5000);
    dom.tutorialToastClose.addEventListener('click', dismiss, { once: true });
};

const startWithSample = async (sampleName) => {
    hideWelcomeScreen();
    initState();
    const mapId = await newMapId();
    state.mapId = mapId;
    history.replaceState({ mapId }, '', `/${mapId}`);

    try {
        const response = await fetch(`samples/${sampleName}.json`, { cache: 'no-cache' });
        if (!response.ok) throw new Error();
        deserialize(await response.json());
    } catch {
        alert('Failed to load sample');
    }
    dom.boardName.value = state.name;
    render();
    requestAnimationFrame(zoomToFit);
    setTimeout(showTutorialToast, 800);

    await createYjsDoc(mapId);
    subscribeToMap(mapId);
    saveToStorage();
    incrementMapCounter();
};

// =============================================================================
// Module Wiring
// =============================================================================

// Wire state module (needs serialize/deserialize + renderAndSave)
stateInit({ dom, serialize, deserialize, renderAndSave });

// Wire navigation module
navigation.init({ dom, state, updateSelectionUI, selection, clearSelection, isMapEditable, addColumnAt, deleteColumn, duplicateColumns, duplicateCards, deleteSelectedColumns, deleteSelectedCards });

// Wire presence module
presence.init({
    getProvider,
    getYdoc,
    dom,
    getZoomLevel: () => navigation.zoomLevel,
    getState: () => state,
});

// Wire lock module
lock.init({
    state,
    dom,
    getProvider,
    getYdoc,
    getCursorColor,
    render,
    notepadUpdate: () => notepad.update(),
    saveToStorage,
    closeMainMenu,
    initSortable,
    renderLegend,
});

// Wire yjs module
yjs.init({
    state,
    notepad,
    dom,
    isMapEditable,
    render,
});

// Materialize phantom columns up to and including the given index (0-based).
// Columns before the target are created hidden (spacers); the target column is visible.
const materializePhantomColumn = (phantomIndex = 0) => {
    pushUndo();
    let targetColumn = null;
    for (let i = 0; i <= phantomIndex; i++) {
        const hidden = i < phantomIndex;
        const column = createColumn('', null, null, hidden);
        state.columns.push(column);
        state.slices.forEach(slice => slice.stories[column.id] = []);
        if (!hidden) targetColumn = column;
    }
    renderAndSave();
    return targetColumn;
};

// Wire ui module
ui.init({
    state,
    dom,
    isMapEditable,
    pushUndo,
    addStory,
    deleteColumn,
    deleteStory,
    deleteSlice,
    saveToStorage,
    renderAndSave,
    scrollElementIntoView,
    addColumn,
    addSlice,
    materializePhantomColumn,
    handleColumnSelection,
});

// Wire render module
renderMod.init({
    state,
    dom,
    isMapEditable,
    pushUndo,
    saveToStorage,
    renderAndSave,
    ensureSortable,
    scrollElementIntoView,
    notepadUpdate: () => notepad.update(),
    getIsSafari: () => isSafari,
    getZoomLevel: () => navigation.zoomLevel,
    broadcastDragStart,
    broadcastDragEnd,
});

// =============================================================================
// Initialize
// =============================================================================

const loadMapById = async (mapId) => {
    destroyYjs();

    if (mapId) {
        state.mapId = mapId;
        await createYjsDoc(mapId);
        await subscribeToMap(mapId);

        // Data arrived via Yjs sync
        if (state.columns.length > 0) {
            return true;
        }

        // Yjs doc may still be loading from server persistence — wait briefly
        const ymap = getYmap();
        if (ymap) {
            const hasData = await new Promise(resolve => {
                let resolved = false;
                const done = (result) => {
                    if (resolved) return;
                    resolved = true;
                    clearTimeout(timeout);
                    ymap.unobserveDeep(check);
                    resolve(result);
                };
                const timeout = setTimeout(() => done(false), 500);
                const check = () => {
                    syncFromYjs();
                    if (state.columns.length > 0) {
                        render();
                        done(true);
                    }
                };
                ymap.observeDeep(check);
            });
            if (hasData) return true;
        }
    }
    return false;
};

const init = async () => {
    const mapId = window.location.pathname.slice(1) || null;

    initEventListeners();
    notepad.init({ state, saveToStorage, isMapEditable });
    updateCursorsVisibilityUI();

    // Populate browser-specific DevTools instructions
    const devtoolsHint = isSafari
        ? 'first enable via Safari &gt; Settings &gt; Advanced &gt; <em>Show features for web developers</em>, then press <strong>Cmd+Option+I</strong>'
        : /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
            ? 'press <strong>Cmd+Option+I</strong>'
            : 'press <strong>F12</strong>';
    document.querySelectorAll('.devtools-instructions').forEach(el => {
        el.innerHTML = devtoolsHint;
    });

    if (mapId) {
        loadYjs(); // Start downloading Yjs modules in parallel with DOM setup
        showLoading();
        const loaded = await loadMapById(mapId);
        hideLoading();
        if (loaded) {
            hideWelcomeScreen();
            requestAnimationFrame(zoomToFit);
            setTimeout(showTutorialToast, 800);
        } else {
            showWelcomeScreen();
        }
    } else {
        showWelcomeScreen();
    }
};

init();
