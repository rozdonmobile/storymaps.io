// Storymaps.io — AGPL-3.0 — see LICENSE for details
// Export Modules
// Requires: dom, state, el, sanitizeFilename from app.js

// ==================== Jira CSV Export ====================

const jiraExportState = {
    selectedSlices: new Set(),
    selectedStatuses: new Set(['none', 'planned', 'in-progress', 'done']),
    epicData: []
};

const showJiraExportModal = () => {
    populateJiraExportSlices();
    populateJiraExportEpics();
    dom.jiraExportModal.classList.add('visible');
};

const hideJiraExportModal = () => {
    dom.jiraExportModal.classList.remove('visible');
};

const confirmCloseJiraExportModal = () => {
    if (confirm('Close export dialog?')) {
        hideJiraExportModal();
    }
};

const populateJiraExportSlices = () => {
    const container = document.getElementById('jiraExportSlices');
    container.innerHTML = '';
    jiraExportState.selectedSlices.clear();

    const slices = state.slices.filter(s => s.rowType !== 'Users' && s.rowType !== 'Activities');

    slices.forEach(slice => {
        const sliceName = slice.name || 'Unnamed Release';
        jiraExportState.selectedSlices.add(slice.id);

        let storyCount = 0;
        state.columns.forEach(column => {
            const stories = slice.stories[column.id] || [];
            storyCount += stories.filter(s => s.name.trim()).length;
        });

        const label = el('label', 'jira-slice-checkbox checked');
        const checkbox = el('input', null, { type: 'checkbox', checked: true });
        checkbox.dataset.sliceId = slice.id;
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                jiraExportState.selectedSlices.add(slice.id);
                label.classList.add('checked');
            } else {
                jiraExportState.selectedSlices.delete(slice.id);
                label.classList.remove('checked');
            }
            populateJiraExportEpics();
        });
        const nameSpan = el('span', 'jira-slice-name', { text: sliceName });
        const countSpan = el('span', 'jira-slice-count', { text: `(${storyCount})` });
        label.append(checkbox, nameSpan, countSpan);
        container.append(label);
    });

    if (slices.length === 0) {
        container.innerHTML = '<span style="color: #666; font-size: 13px;">No releases found</span>';
    }
};

const populateJiraExportEpics = () => {
    dom.jiraExportEpics.innerHTML = '';
    jiraExportState.epicData = [];

    state.columns.forEach((column, colIndex) => {
        const tasks = [];
        state.slices.forEach(slice => {
            if (slice.rowType === 'Users' || slice.rowType === 'Activities') return;
            if (!jiraExportState.selectedSlices.has(slice.id)) return;

            const sliceStories = slice.stories[column.id] || [];
            sliceStories.forEach(story => {
                if (story.name.trim()) {
                    const storyStatus = story.status || 'none';
                    if (!jiraExportState.selectedStatuses.has(storyStatus)) return;

                    tasks.push({
                        name: story.name,
                        status: story.status || null,
                        url: story.url || null,
                        included: true
                    });
                }
            });
        });

        if (tasks.length === 0) return;

        const epicData = {
            columnId: column.id,
            name: column.name || `Activity ${colIndex + 1}`,
            type: 'Epic',
            description: '',
            included: true,
            tasks
        };
        jiraExportState.epicData.push(epicData);

        const epicDiv = el('div', 'jira-export-epic');
        epicDiv.dataset.columnId = column.id;

        const header = el('div', 'jira-export-epic-header');

        const checkbox = el('input', 'jira-export-epic-checkbox', { type: 'checkbox', checked: true });
        checkbox.addEventListener('change', (e) => {
            epicData.included = e.target.checked;
            epicDiv.classList.toggle('excluded', !e.target.checked);
        });

        const nameInput = el('input', 'jira-export-epic-name', {
            type: 'text',
            value: epicData.name,
            placeholder: 'Epic name'
        });
        nameInput.addEventListener('input', (e) => {
            epicData.name = e.target.value;
        });

        const typeSelect = el('select', 'jira-export-epic-type', { title: 'Jira issue type' });
        ['Epic', 'Task'].forEach(type => {
            const option = el('option', null, { value: type, text: type });
            typeSelect.append(option);
        });
        typeSelect.addEventListener('change', (e) => {
            epicData.type = e.target.value;
        });

        header.append(checkbox, nameInput, typeSelect);

        const description = el('textarea', 'jira-export-epic-description', {
            placeholder: 'Optional description for this epic...',
            rows: 2
        });
        description.addEventListener('input', (e) => {
            epicData.description = e.target.value;
        });

        const tasksList = el('div', 'jira-export-tasks');
        tasks.forEach((task, taskIndex) => {
            const taskEl = el('label', 'jira-export-task');

            const taskCheckbox = el('input', 'jira-export-task-checkbox', { type: 'checkbox', checked: true });
            taskCheckbox.addEventListener('change', (e) => {
                task.included = e.target.checked;
                taskEl.classList.toggle('excluded', !e.target.checked);
            });
            taskEl.append(taskCheckbox);

            const nameSpan = el('span', 'jira-export-task-name', { text: task.name });
            taskEl.append(nameSpan);

            const statusClass = task.status === 'done' ? 'done' :
                task.status === 'in-progress' ? 'in-progress' :
                task.status === 'planned' ? 'planned' : 'none';
            const jiraStatus = task.status === 'done' ? dom.jiraStatusDone.value :
                task.status === 'in-progress' ? dom.jiraStatusInProgress.value :
                task.status === 'planned' ? dom.jiraStatusPlanned.value :
                dom.jiraStatusNone.value;
            const statusBadge = el('span', `jira-export-task-status ${statusClass}`, { text: jiraStatus });
            taskEl.append(statusBadge);
            tasksList.append(taskEl);
        });

        epicDiv.append(header, description, tasksList);
        dom.jiraExportEpics.append(epicDiv);
    });

    if (dom.jiraExportEpics.children.length === 0) {
        const emptyMsg = el('p', null, {
            style: 'color: #666; text-align: center; padding: 20px;',
            text: 'No stories to export. Add some stories to your map first, or select more releases above.'
        });
        dom.jiraExportEpics.append(emptyMsg);
    }

    const epicCount = jiraExportState.epicData.length;
    const taskCount = jiraExportState.epicData.reduce((sum, epic) => sum + epic.tasks.length, 0);
    if (dom.jiraExportCount) {
        dom.jiraExportCount.textContent = epicCount > 0 ? `(${epicCount} epics, ${taskCount} tasks)` : '';
    }
};

const escapeCSV = (str) => {
    if (str == null) return '';
    const s = String(str);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
};

const generateJiraCsv = () => {
    const rows = [];
    const projectName = dom.jiraProjectName.value.trim();
    const projectKey = dom.jiraProjectKey.value.trim().toUpperCase();
    const projectType = dom.jiraProjectType.value;
    const childType = 'Task';
    const hasProject = projectName && projectKey;
    const defaultDesc = 'Imported from Storymaps.io';

    const headers = ['Work type', 'Summary', 'Description', 'Work item ID', 'Parent', 'Status', 'Project type'];
    if (hasProject) {
        headers.unshift('Project key');
        headers.unshift('Project name');
    }
    rows.push(headers.map(escapeCSV).join(','));

    let issueId = 1;
    const epicInputs = dom.jiraExportEpics.querySelectorAll('.jira-export-epic');

    epicInputs.forEach((epicEl) => {
        const checkbox = epicEl.querySelector('.jira-export-epic-checkbox');
        if (!checkbox.checked) return;

        const epicId = issueId++;
        const nameInput = epicEl.querySelector('.jira-export-epic-name');
        const typeSelect = epicEl.querySelector('.jira-export-epic-type');
        const descTextarea = epicEl.querySelector('.jira-export-epic-description');

        const epicName = nameInput.value || 'Untitled Epic';
        const epicType = typeSelect.value || 'Epic';
        const epicDesc = descTextarea.value || defaultDesc;

        const epicRow = [epicType, epicName, epicDesc, epicId, '', '', projectType];
        if (hasProject) {
            epicRow.unshift(projectKey);
            epicRow.unshift(projectName);
        }
        rows.push(epicRow.map(escapeCSV).join(','));

        const taskEls = epicEl.querySelectorAll('.jira-export-task');
        taskEls.forEach((taskEl) => {
            const taskCheckbox = taskEl.querySelector('.jira-export-task-checkbox');
            if (!taskCheckbox.checked) return;

            const taskName = taskEl.querySelector('.jira-export-task-name')?.textContent || '';
            const statusBadge = taskEl.querySelector('.jira-export-task-status');
            const jiraStatus = statusBadge?.textContent || dom.jiraStatusNone.value;

            const taskRow = [childType, taskName, defaultDesc, issueId++, epicId, jiraStatus, projectType];
            if (hasProject) {
                taskRow.unshift(projectKey);
                taskRow.unshift(projectName);
            }
            rows.push(taskRow.map(escapeCSV).join(','));
        });
    });

    return rows.join('\n');
};

const downloadJiraCsv = () => {
    const csv = generateJiraCsv();
    const filename = sanitizeFilename(state.name || 'story-map') + '-jira.csv';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = el('a', null, { href: url, download: filename });
    link.click();
    URL.revokeObjectURL(url);
    hideJiraExportModal();
};

// ==================== Phabricator Export ====================

const phabExportState = {
    selectedSlices: new Set(),
    selectedStatuses: new Set(['none', 'planned', 'in-progress', 'done']),
    epicData: []
};

const showPhabExportModal = () => {
    populatePhabExportSlices();
    populatePhabExportEpics();
    dom.phabStage1.classList.remove('hidden');
    dom.phabStage2.classList.add('hidden');
    dom.phabExportTitle.textContent = 'Step 1: Select Tasks';
    dom.phabExportModal.classList.add('visible');
};

const hidePhabExportModal = () => {
    dom.phabExportModal.classList.remove('visible');
};

const confirmClosePhabModal = () => {
    if (confirm('Close export dialog?')) {
        hidePhabExportModal();
    }
};

const populatePhabExportSlices = () => {
    const container = dom.phabExportSlices;
    container.innerHTML = '';
    phabExportState.selectedSlices.clear();

    const slices = state.slices.filter(s => s.rowType !== 'Users' && s.rowType !== 'Activities');

    slices.forEach(slice => {
        const sliceName = slice.name || 'Unnamed Release';
        phabExportState.selectedSlices.add(slice.id);

        let storyCount = 0;
        state.columns.forEach(column => {
            const stories = slice.stories[column.id] || [];
            storyCount += stories.filter(s => s.name.trim()).length;
        });

        const label = el('label', 'phab-slice-checkbox checked');
        const checkbox = el('input', null, { type: 'checkbox', checked: true });
        checkbox.dataset.sliceId = slice.id;
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                phabExportState.selectedSlices.add(slice.id);
                label.classList.add('checked');
            } else {
                phabExportState.selectedSlices.delete(slice.id);
                label.classList.remove('checked');
            }
            populatePhabExportEpics();
        });
        const nameSpan = el('span', 'phab-slice-name', { text: sliceName });
        const countSpan = el('span', 'phab-slice-count', { text: `(${storyCount})` });
        label.append(checkbox, nameSpan, countSpan);
        container.append(label);
    });

    if (slices.length === 0) {
        container.innerHTML = '<span style="color: #666; font-size: 13px;">No releases found</span>';
    }
};

const populatePhabExportEpics = () => {
    dom.phabExportEpics.innerHTML = '';
    phabExportState.epicData = [];

    state.columns.forEach((column, colIndex) => {
        const tasks = [];
        state.slices.forEach(slice => {
            if (slice.rowType === 'Users' || slice.rowType === 'Activities') return;
            if (!phabExportState.selectedSlices.has(slice.id)) return;

            const sliceStories = slice.stories[column.id] || [];
            sliceStories.forEach(story => {
                if (story.name.trim()) {
                    const storyStatus = story.status || 'none';
                    if (!phabExportState.selectedStatuses.has(storyStatus)) return;

                    tasks.push({
                        name: story.name,
                        status: story.status || null,
                        included: true
                    });
                }
            });
        });

        if (tasks.length === 0) return;

        const epicData = {
            columnId: column.id,
            name: column.name || `Activity ${colIndex + 1}`,
            description: '',
            included: true,
            type: 'epic',
            tasks
        };
        phabExportState.epicData.push(epicData);

        const epicDiv = el('div', 'phab-export-epic');
        epicDiv.dataset.columnId = column.id;

        const header = el('div', 'phab-export-epic-header');

        const checkbox = el('input', 'phab-export-epic-checkbox', { type: 'checkbox', checked: true });
        checkbox.addEventListener('change', (e) => {
            epicData.included = e.target.checked;
            epicDiv.classList.toggle('excluded', !e.target.checked);
        });

        const nameInput = el('input', 'phab-export-epic-name', {
            type: 'text',
            value: epicData.name,
            placeholder: 'Epic name'
        });
        nameInput.addEventListener('input', (e) => {
            epicData.name = e.target.value;
        });

        const typeSelect = el('select', 'phab-export-epic-type');
        const epicOption = el('option', null, { value: 'epic', text: 'Epic' });
        const taskOption = el('option', null, { value: 'task', text: 'Task' });
        typeSelect.append(epicOption, taskOption);
        typeSelect.addEventListener('change', (e) => {
            epicData.type = e.target.value;
        });

        header.append(checkbox, nameInput, typeSelect);

        const description = el('textarea', 'phab-export-epic-description', {
            placeholder: 'Optional description for this epic...',
            rows: 2
        });
        description.addEventListener('input', (e) => {
            epicData.description = e.target.value;
        });

        const tasksList = el('div', 'phab-export-tasks');
        tasks.forEach((task) => {
            const taskEl = el('label', 'phab-export-task');
            taskEl.dataset.status = task.status || 'none';

            const taskCheckbox = el('input', 'phab-export-task-checkbox', { type: 'checkbox', checked: true });
            taskCheckbox.addEventListener('change', (e) => {
                task.included = e.target.checked;
                taskEl.classList.toggle('excluded', !e.target.checked);
            });
            taskEl.append(taskCheckbox);

            const nameSpan = el('span', 'phab-export-task-name', { text: task.name });
            taskEl.append(nameSpan);

            const statusClass = task.status === 'done' ? 'done' :
                task.status === 'in-progress' ? 'in-progress' :
                task.status === 'planned' ? 'planned' : 'none';
            const statusText = task.status === 'done' ? 'Done' :
                task.status === 'in-progress' ? 'In Progress' :
                task.status === 'planned' ? 'Planned' : 'No Status';
            const statusBadge = el('span', `phab-export-task-status ${statusClass}`, { text: statusText });
            taskEl.append(statusBadge);
            tasksList.append(taskEl);
        });

        epicDiv.append(header, description, tasksList);
        dom.phabExportEpics.append(epicDiv);
    });

    if (dom.phabExportEpics.children.length === 0) {
        const emptyMsg = el('p', null, {
            style: 'color: #666; text-align: center; padding: 20px;',
            text: 'No stories to export. Add some stories to your map first, or select more releases above.'
        });
        dom.phabExportEpics.append(emptyMsg);
    }

    const epicCount = phabExportState.epicData.length;
    const taskCount = phabExportState.epicData.reduce((sum, epic) => sum + epic.tasks.length, 0);
    if (dom.phabExportCount) {
        dom.phabExportCount.textContent = epicCount > 0 ? `(${epicCount} epics, ${taskCount} tasks)` : '';
    }
};

const generatePhabImportFunction = () => {
    return `async function importTasks(token, items, tags) {
  const url = '${getPhabBaseUrl()}/api/maniphest.edit';
  async function createTask(t, parentId, itemTags) {
    const indent = parentId ? '  ' : '';
    const params = new URLSearchParams();
    params.set('api.token', token);
    let i = 0;
    params.set('transactions[' + i + '][type]', 'title');
    params.set('transactions[' + i++ + '][value]', t.title);
    params.set('transactions[' + i + '][type]', 'description');
    params.set('transactions[' + i++ + '][value]', t.description || '');
    if (t.status) {
      params.set('transactions[' + i + '][type]', 'status');
      params.set('transactions[' + i++ + '][value]', t.status);
    }
    if (parentId) {
      params.set('transactions[' + i + '][type]', 'parent');
      params.set('transactions[' + i++ + '][value]', parentId);
    }
    if (itemTags && itemTags.length) {
      params.set('transactions[' + i + '][type]', 'projects.add');
      itemTags.forEach((tag, j) => params.set('transactions[' + i + '][value][' + j + ']', tag));
    }
    const r = await (await fetch(url, {method:'POST', body:params, credentials:'omit'})).json();
    if (r.error_code) { console.log(indent + '✗ ' + t.title + ': ' + r.error_info); return null; }
    console.log(indent + '✓ T' + r.result.object.id + ': ' + t.title);
    return r.result.object.phid;
  }
  for (const item of items) {
    const itemTags = item.type === 'epic' ? ['epic', ...tags] : [...tags];
    const itemId = await createTask(item, null, itemTags);
    if (itemId && item.subtasks) {
      for (const sub of item.subtasks) { await createTask(sub, itemId, tags); }
    }
  }
  console.log('Import complete!');
}`;
};

const getPhabBaseUrl = () => {
    const input = dom.phabInstanceUrl.value.trim();
    if (!input) return 'https://phabricator.example.com';
    if (!input.startsWith('http://') && !input.startsWith('https://')) {
        return 'https://' + input;
    }
    return input;
};

const generatePhabImportCall = () => {
    const epics = [];
    const epicEls = dom.phabExportEpics.querySelectorAll('.phab-export-epic');

    epicEls.forEach((epicEl) => {
        const checkbox = epicEl.querySelector('.phab-export-epic-checkbox');
        if (!checkbox.checked) return;

        const nameInput = epicEl.querySelector('.phab-export-epic-name');
        const descTextarea = epicEl.querySelector('.phab-export-epic-description');
        const typeSelect = epicEl.querySelector('.phab-export-epic-type');

        const epicName = nameInput.value || 'Untitled Epic';
        const epicDesc = descTextarea.value || '';
        const epicType = typeSelect?.value || 'epic';

        const subtasks = [];
        const phabStatusMap = {none: 'open', planned: 'open', 'in-progress': 'progress', done: 'resolved'};
        const taskEls = epicEl.querySelectorAll('.phab-export-task');
        taskEls.forEach((taskEl) => {
            const taskCheckbox = taskEl.querySelector('.phab-export-task-checkbox');
            if (!taskCheckbox.checked) return;

            const taskName = taskEl.querySelector('.phab-export-task-name')?.textContent || '';
            const taskStatus = phabStatusMap[taskEl.dataset.status] || 'open';
            subtasks.push({ title: taskName, description: 'Imported from Storymaps.io', status: taskStatus });
        });

        if (subtasks.length > 0) {
            epics.push({
                title: epicName,
                description: epicDesc || 'Imported from Storymaps.io',
                type: epicType,
                subtasks
            });
        }
    });

    const token = dom.phabApiToken.value.trim() || '<enter token above>';
    const tagsInput = dom.phabTags.value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
    return `importTasks('${token}', ${JSON.stringify(epics, null, 2)}, ${JSON.stringify(tags)});`;
};

const showPhabStage2 = () => {
    dom.phabStage1.classList.add('hidden');
    dom.phabStage2.classList.remove('hidden');
    dom.phabExportTitle.textContent = 'Step 2: Import';

    dom.phabImportFunction.textContent = generatePhabImportFunction();
    dom.phabImportCall.textContent = generatePhabImportCall();
};

const showPhabStage1 = () => {
    dom.phabStage1.classList.remove('hidden');
    dom.phabStage2.classList.add('hidden');
    dom.phabExportTitle.textContent = 'Step 1: Select Tasks';
};

const copyPhabCode = async (element, button) => {
    const text = element.textContent;
    try {
        await navigator.clipboard.writeText(text);
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => button.textContent = originalText, 2000);
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => button.textContent = originalText, 2000);
    }
};

// ==================== Jira API Export ====================

const jiraApiExportState = {
    selectedSlices: new Set(),
    selectedStatuses: new Set(['none', 'planned', 'in-progress', 'done']),
    epicData: []
};

const showJiraApiExportModal = () => {
    populateJiraApiExportSlices();
    populateJiraApiExportEpics();
    dom.jiraApiStage1.classList.remove('hidden');
    dom.jiraApiStage2.classList.add('hidden');
    dom.jiraApiExportTitle.textContent = 'Export to Jira';
    dom.jiraApiExportModal.classList.add('visible');
};

const hideJiraApiExportModal = () => {
    dom.jiraApiExportModal.classList.remove('visible');
};

const confirmCloseJiraApiModal = () => {
    if (confirm('Close export dialog?')) {
        hideJiraApiExportModal();
    }
};

const populateJiraApiExportSlices = () => {
    const container = dom.jiraApiExportSlices;
    container.innerHTML = '';
    jiraApiExportState.selectedSlices.clear();

    const slices = state.slices.filter(s => s.rowType !== 'Users' && s.rowType !== 'Activities');

    slices.forEach(slice => {
        const sliceName = slice.name || 'Unnamed Release';
        jiraApiExportState.selectedSlices.add(slice.id);

        let storyCount = 0;
        state.columns.forEach(column => {
            const stories = slice.stories[column.id] || [];
            storyCount += stories.filter(s => s.name.trim()).length;
        });

        const label = el('label', 'phab-slice-checkbox checked');
        const checkbox = el('input', null, { type: 'checkbox', checked: true });
        checkbox.dataset.sliceId = slice.id;
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                jiraApiExportState.selectedSlices.add(slice.id);
                label.classList.add('checked');
            } else {
                jiraApiExportState.selectedSlices.delete(slice.id);
                label.classList.remove('checked');
            }
            populateJiraApiExportEpics();
        });
        const nameSpan = el('span', 'phab-slice-name', { text: sliceName });
        const countSpan = el('span', 'phab-slice-count', { text: `(${storyCount})` });
        label.append(checkbox, nameSpan, countSpan);
        container.append(label);
    });
};

const populateJiraApiExportEpics = () => {
    dom.jiraApiExportEpics.innerHTML = '';
    jiraApiExportState.epicData = [];

    state.columns.forEach((column, colIndex) => {
        const tasks = [];
        state.slices.forEach(slice => {
            if (slice.rowType === 'Users' || slice.rowType === 'Activities') return;
            if (!jiraApiExportState.selectedSlices.has(slice.id)) return;

            const sliceStories = slice.stories[column.id] || [];
            sliceStories.forEach(story => {
                if (story.name.trim()) {
                    const storyStatus = story.status || 'none';
                    if (!jiraApiExportState.selectedStatuses.has(storyStatus)) return;

                    tasks.push({
                        name: story.name,
                        status: story.status || null,
                        included: true
                    });
                }
            });
        });

        if (tasks.length === 0) return;

        const epicData = {
            columnId: column.id,
            name: column.name || `Activity ${colIndex + 1}`,
            description: '',
            included: true,
            tasks
        };
        jiraApiExportState.epicData.push(epicData);

        const epicDiv = el('div', 'phab-export-epic');
        epicDiv.dataset.columnId = column.id;

        const header = el('div', 'phab-export-epic-header');

        const checkbox = el('input', 'phab-export-epic-checkbox', { type: 'checkbox', checked: true });
        checkbox.addEventListener('change', (e) => {
            epicData.included = e.target.checked;
            epicDiv.classList.toggle('excluded', !e.target.checked);
        });

        const nameInput = el('input', 'phab-export-epic-name', {
            type: 'text',
            value: epicData.name,
            placeholder: 'Epic name'
        });
        nameInput.addEventListener('input', (e) => {
            epicData.name = e.target.value;
        });

        header.append(checkbox, nameInput);

        const description = el('textarea', 'phab-export-epic-description', {
            placeholder: 'Epic description (optional)',
            rows: 2
        });
        description.addEventListener('input', (e) => {
            epicData.description = e.target.value;
        });

        const tasksList = el('div', 'phab-export-tasks');
        tasks.forEach((task) => {
            const taskEl = el('label', 'phab-export-task');
            taskEl.dataset.status = task.status || 'none';

            const taskCheckbox = el('input', 'phab-export-task-checkbox', { type: 'checkbox', checked: true });
            taskCheckbox.addEventListener('change', (e) => {
                task.included = e.target.checked;
                taskEl.classList.toggle('excluded', !e.target.checked);
            });
            taskEl.append(taskCheckbox);

            const nameSpan = el('span', 'phab-export-task-name', { text: task.name });
            taskEl.append(nameSpan);

            const statusClass = task.status === 'done' ? 'done' :
                task.status === 'in-progress' ? 'in-progress' :
                task.status === 'planned' ? 'planned' : 'none';
            const statusText = task.status === 'done' ? 'Done' :
                task.status === 'in-progress' ? 'In Progress' :
                task.status === 'planned' ? 'Planned' : 'No Status';
            const statusBadge = el('span', `phab-export-task-status ${statusClass}`, { text: statusText });
            taskEl.append(statusBadge);
            tasksList.append(taskEl);
        });

        epicDiv.append(header, description, tasksList);
        dom.jiraApiExportEpics.append(epicDiv);
    });

    if (dom.jiraApiExportEpics.children.length === 0) {
        const emptyMsg = el('p', null, {
            style: 'color: #666; text-align: center; padding: 20px;',
            text: 'No stories to export. Add some stories to your map first, or select more releases above.'
        });
        dom.jiraApiExportEpics.append(emptyMsg);
    }

    const epicCount = jiraApiExportState.epicData.length;
    const taskCount = jiraApiExportState.epicData.reduce((sum, epic) => sum + epic.tasks.length, 0);
    if (dom.jiraApiExportCount) {
        dom.jiraApiExportCount.textContent = epicCount > 0 ? `(${epicCount} epics, ${taskCount} stories)` : '';
    }
};

const generateJiraApiImportFunction = () => {
    return `async function importToJira(email, token, projectKey, epics) {
  const auth = btoa(email + ':' + token);
  const headers = {
    'Authorization': 'Basic ' + auth,
    'Content-Type': 'application/json'
  };

  for (const epic of epics) {
    console.log('Creating Epic: ' + epic.summary);
    const epicRes = await fetch('/rest/api/3/issue', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary: epic.summary,
          description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: epic.description || 'Imported from Storymaps.io' }] }] },
          issuetype: { name: 'Epic' }
        }
      })
    });
    const epicData = await epicRes.json();
    if (epicData.errors) {
      console.log('✗ Epic failed:', epicData.errors);
      continue;
    }
    console.log('✓ Created Epic: ' + epicData.key);

    for (const story of epic.stories) {
      const storyRes = await fetch('/rest/api/3/issue', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fields: {
            project: { key: projectKey },
            summary: story.summary,
            description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Imported from Storymaps.io' }] }] },
            issuetype: { name: 'Story' },
            parent: { key: epicData.key }
          }
        })
      });
      const storyData = await storyRes.json();
      if (storyData.errors) {
        console.log('  ✗ Story failed:', storyData.errors);
      } else {
        console.log('  ✓ Created Story: ' + storyData.key + ' - ' + story.summary);
      }
    }
  }
  console.log('\\nImport complete!');
}`;
};

const generateJiraApiImportCall = () => {
    const epics = [];
    const epicEls = dom.jiraApiExportEpics.querySelectorAll('.phab-export-epic');

    epicEls.forEach((epicEl) => {
        const checkbox = epicEl.querySelector('.phab-export-epic-checkbox');
        if (!checkbox.checked) return;

        const nameInput = epicEl.querySelector('.phab-export-epic-name');
        const descTextarea = epicEl.querySelector('.phab-export-epic-description');

        const epicName = nameInput.value || 'Untitled Epic';
        const epicDesc = descTextarea.value || '';

        const stories = [];
        const taskEls = epicEl.querySelectorAll('.phab-export-task');
        taskEls.forEach((taskEl) => {
            const taskCheckbox = taskEl.querySelector('.phab-export-task-checkbox');
            if (!taskCheckbox.checked) return;

            const taskName = taskEl.querySelector('.phab-export-task-name')?.textContent || '';
            stories.push({ summary: taskName });
        });

        if (stories.length > 0) {
            epics.push({
                summary: epicName,
                description: epicDesc,
                stories
            });
        }
    });

    const email = dom.jiraApiEmail.value.trim() || '<enter email above>';
    const token = dom.jiraApiToken.value.trim() || '<enter token above>';
    const projectKey = dom.jiraApiProjectKey.value.trim().toUpperCase() || '<enter project key above>';

    return `importToJira('${email}', '${token}', '${projectKey}', ${JSON.stringify(epics, null, 2)});`;
};

const showJiraApiStage2 = () => {
    dom.jiraApiStage1.classList.add('hidden');
    dom.jiraApiStage2.classList.remove('hidden');
    dom.jiraApiExportTitle.textContent = 'Step 2: Import';

    dom.jiraApiImportFunction.textContent = generateJiraApiImportFunction();
    dom.jiraApiImportCall.textContent = generateJiraApiImportCall();
};

const showJiraApiStage1 = () => {
    dom.jiraApiStage1.classList.remove('hidden');
    dom.jiraApiStage2.classList.add('hidden');
    dom.jiraApiExportTitle.textContent = 'Step 1: Select Stories';
};
