// Storymaps.io — AGPL-3.0 — see LICENCE for details
// Serialization / deserialization (pure functions)

import { CARD_COLORS, isValidUrl } from '/src/constants.js';
import { state, createColumn, createStory } from '/src/state.js';
import { generateId } from '/src/constants.js';

export const serialize = () => ({
    app: 'storymap',
    v: 1,
    exported: new Date().toISOString(),
    name: state.name,
    a: state.columns.map(s => {
        const obj = { n: s.name };
        if (s.color) obj.c = s.color;
        if (s.url) obj.u = s.url;
        if (s.hidden) obj.h = true;
        if (s.status) obj.st = s.status;
        if (s.points != null) obj.sp = s.points;
        if (s.tags?.length) obj.tg = s.tags;
        return obj;
    }),
    s: state.slices.map(slice => {
        const obj = {
            n: slice.name,
            t: state.columns.map(s => (slice.stories[s.id] || []).map(story => {
                const sObj = { n: story.name };
                if (story.color) sObj.c = story.color;
                if (story.url) sObj.u = story.url;
                if (story.hidden) sObj.h = true;
                if (story.status) sObj.st = story.status;
                if (story.points != null) sObj.sp = story.points;
                if (story.tags?.length) sObj.tg = story.tags;
                return sObj;
            }))
        };
        if (slice.separator === false) obj.sep = false;
        if (slice.rowType) obj.rt = slice.rowType;
        if (slice.collapsed) obj.col = true;
        return obj;
    }),
    ...(state.legend.length > 0 && {
        l: state.legend.map(entry => ({ c: entry.color, n: entry.label }))
    }),
    ...(state.notes && { notes: state.notes })
});

export const deserialize = (data) => {
    if (data?.app !== 'storymap' || data?.v !== 1 || !Array.isArray(data.a) || !Array.isArray(data.s)) {
        throw new Error('Invalid format');
    }

    // Sanitize URL - only allow valid http/https URLs
    const sanitizeUrl = (url) => isValidUrl(url) ? url : null;

    state.name = data.name || '';
    state.columns = data.a.map(a => {
        return createColumn(a.n || '', a.c || null, sanitizeUrl(a.u), !!a.h, a.st || null, a.sp ?? null, Array.isArray(a.tg) ? a.tg : []);
    });
    state.slices = data.s.map(slice => {
        const newSlice = {
            id: generateId(),
            name: slice.n || '',
            separator: slice.sep !== false,
            rowType: slice.rt || null,
            collapsed: !!slice.col,
            stories: {}
        };
        const stories = Array.isArray(slice.t) ? slice.t : [];
        state.columns.forEach((col, i) => {
            newSlice.stories[col.id] = (stories[i] || []).map(t => {
                return createStory(t.n || '', t.c || null, sanitizeUrl(t.u), !!t.h, t.st || null, t.sp ?? null, Array.isArray(t.tg) ? t.tg : []);
            });
        });
        return newSlice;
    });
    state.legend = Array.isArray(data.l) ? data.l.map(entry => ({
        id: generateId(),
        color: entry.c || CARD_COLORS.yellow,
        label: entry.n || ''
    })) : [];
    state.notes = data.notes || '';
};
