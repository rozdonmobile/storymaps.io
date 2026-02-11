// Storymaps.io — AGPL-3.0 — see LICENCE for details
// Navigation: zoom, pan, scroll, menu helpers

import { ZOOM_LEVELS } from '/src/constants.js';

let _dom = null;
let _state = null;

// Zoom state
export let zoomLevel = 1;
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 3;

// Pan/drag state
export let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panScrollLeft = 0;
let panScrollTop = 0;

export const init = ({ dom, state }) => {
    _dom = dom;
    _state = state;
};

const updatePanMode = () => {
    const wrapper = _dom.storyMapWrapper;
    const hasOverflow = wrapper.scrollWidth > wrapper.clientWidth || wrapper.scrollHeight > wrapper.clientHeight;
    if (hasOverflow) {
        wrapper.classList.add('pan-enabled');
    } else {
        wrapper.classList.remove('pan-enabled');
    }
};

export const updateZoom = () => {
    _dom.storyMap.style.transform = `scale(${zoomLevel})`;
    _dom.storyMap.style.setProperty('--zoom', zoomLevel);
    _dom.zoomReset.textContent = `${Math.round(zoomLevel * 100)}%`;
    updatePanMode();
};

// Scroll to position content naturally in viewport
export const centerScroll = () => {
    const wrapper = _dom.storyMapWrapper;
    const map = _dom.storyMap;

    // Compute actual column content width (map has min-width: 100vw so offsetWidth is unreliable)
    const CARD_W = 180, LABEL_W = 80, GAP = 10;
    const cols = _state.columns.length;
    const contentW = (LABEL_W + cols * (CARD_W + GAP)) * zoomLevel;
    const slack = wrapper.clientWidth - contentW;

    if (slack > 0 && cols < 7) {
        // Align with header left edge (header is max-width:1400px, centered)
        const headerOffset = Math.max(0, (wrapper.clientWidth - 1400) / 2);
        wrapper.scrollLeft = map.offsetLeft - headerOffset;
    } else if (slack > 0) {
        // Wider map on large screen: offset 1/3 of gap to left
        wrapper.scrollLeft = map.offsetLeft - slack / 3;
    } else {
        wrapper.scrollLeft = map.offsetLeft;
    }

    // Vertically: start near the top with a small breathing offset
    wrapper.scrollTop = map.offsetTop - 20;
};

// Auto-fit content to viewport width
export const zoomToFit = () => {
    const wrapper = _dom.storyMapWrapper;

    // Calculate content width based on column count + phantom buffer
    const CARD_WIDTH = 180;
    const LABEL_WIDTH = 80;
    const GAP = 10;
    const PHANTOM_COUNT = 3;
    const BODY_PADDING = 48;

    const columnCount = _state.columns.length + PHANTOM_COUNT;
    const contentWidth = LABEL_WIDTH + (columnCount * CARD_WIDTH) + (columnCount * GAP);

    const availableWidth = wrapper.clientWidth - BODY_PADDING;

    const fitZoom = Math.min(1, (availableWidth - 20) / contentWidth);

    // On small screens, don't zoom below 0.5 — users scroll horizontally instead
    const effectiveMin = wrapper.clientWidth < 600 ? 0.5 : ZOOM_MIN;
    zoomLevel = Math.max(effectiveMin, Math.min(ZOOM_MAX, Math.floor(fitZoom * 20) / 20));

    updateZoom();
    centerScroll();
};

// Scroll element into view with padding
export const scrollElementIntoView = (element) => {
    if (!element) return;
    const wrapper = _dom.storyMapWrapper;
    const rect = element.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const padding = 40;

    // Use viewport coordinates directly — no zoom division needed
    if (rect.right > wrapperRect.right - padding) {
        wrapper.scrollLeft += rect.right - wrapperRect.right + padding;
    }
    if (rect.left < wrapperRect.left + padding) {
        wrapper.scrollLeft -= wrapperRect.left + padding - rect.left;
    }
    if (rect.bottom > wrapperRect.bottom - padding) {
        wrapper.scrollTop += rect.bottom - wrapperRect.bottom + padding;
    }
};

export const initPan = () => {
    const wrapper = _dom.storyMapWrapper;

    // Suppress context menu on the wrapper so right-click is free for panning
    wrapper.addEventListener('contextmenu', (e) => e.preventDefault());

    wrapper.addEventListener('mousedown', (e) => {
        if (e.button !== 2) return;
        e.preventDefault();

        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panScrollLeft = wrapper.scrollLeft;
        panScrollTop = wrapper.scrollTop;
        wrapper.classList.add('panning');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        wrapper.scrollLeft = panScrollLeft - (e.clientX - panStartX);
        wrapper.scrollTop = panScrollTop - (e.clientY - panStartY);
    });

    document.addEventListener('mouseup', (e) => {
        if (!isPanning) return;
        isPanning = false;
        wrapper.classList.remove('panning');
    });
};

// Menu helpers

export const closeMainMenu = () => {
    _dom.mainMenu.classList.remove('visible');
    _dom.samplesSubmenu.classList.remove('visible');
    _dom.samplesSubmenuTrigger.classList.remove('expanded');
    _dom.exportSubmenu.classList.remove('visible');
    _dom.exportSubmenuTrigger.classList.remove('expanded');
    document.body.classList.remove('main-menu-open');
};

export const closeAllOptionsMenus = () => {
    document.querySelectorAll('.options-menu.visible').forEach(m => {
        m.classList.remove('visible');
        m.closest('.step, .story-card')?.classList.remove('menu-open');
        m.parentElement?.querySelector('.btn-options')?.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.slice-menu-dropdown.visible').forEach(m => {
        m.classList.remove('visible');
    });
};

export const initWheelZoom = () => {
    _dom.storyMapWrapper.addEventListener('wheel', (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const wrapper = _dom.storyMapWrapper;
        const wrapperRect = wrapper.getBoundingClientRect();
        const oldZoom = zoomLevel;

        const delta = -e.deltaY * 0.0008;
        zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomLevel + delta));

        // Content-space coordinate under the cursor (relative to map origin)
        const mapLeft = _dom.storyMap.offsetLeft;
        const mapTop = _dom.storyMap.offsetTop;
        const cursorX = (e.clientX - wrapperRect.left + wrapper.scrollLeft - mapLeft) / oldZoom;
        const cursorY = (e.clientY - wrapperRect.top + wrapper.scrollTop - mapTop) / oldZoom;

        // Apply transform + label directly (skip updatePanMode to avoid layout thrashing)
        _dom.storyMap.style.transform = `scale(${zoomLevel})`;
        _dom.storyMap.style.setProperty('--zoom', zoomLevel);
        _dom.zoomReset.textContent = `${Math.round(zoomLevel * 100)}%`;

        // Scroll so the same content point stays under the cursor
        wrapper.scrollLeft = mapLeft + cursorX * zoomLevel - (e.clientX - wrapperRect.left);
        wrapper.scrollTop = mapTop + cursorY * zoomLevel - (e.clientY - wrapperRect.top);

        // Defer pan mode update to next frame
        requestAnimationFrame(() => {
            updatePanMode();
        });
    }, { passive: false });
};

// Zoom keeping the viewport center stable
const zoomAroundCenter = (newZoom) => {
    const wrapper = _dom.storyMapWrapper;
    const oldZoom = zoomLevel;
    const mapLeft = _dom.storyMap.offsetLeft;
    const mapTop = _dom.storyMap.offsetTop;

    // Content-space coordinate at viewport center
    const cx = (wrapper.scrollLeft + wrapper.clientWidth / 2 - mapLeft) / oldZoom;
    const cy = (wrapper.scrollTop + wrapper.clientHeight / 2 - mapTop) / oldZoom;

    zoomLevel = newZoom;
    updateZoom();

    // Scroll so the same content point stays at viewport center
    wrapper.scrollLeft = mapLeft + cx * zoomLevel - wrapper.clientWidth / 2;
    wrapper.scrollTop = mapTop + cy * zoomLevel - wrapper.clientHeight / 2;
};

export const zoomIn = () => {
    zoomAroundCenter(Math.min(ZOOM_MAX, zoomLevel + ZOOM_STEP));
};

export const zoomOut = () => {
    zoomAroundCenter(Math.max(ZOOM_MIN, zoomLevel - ZOOM_STEP));
};

export const zoomCycle = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    zoomAroundCenter(ZOOM_LEVELS[(currentIndex + 1) % ZOOM_LEVELS.length]);
};

