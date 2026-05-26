const CONFIG = {
    GROUPS: ['工作', '学习', '生活'],
    TAGS: ['重要', '紧急', '日常'],
    STORAGE_KEYS: {
        TASKS: 'tasks',
        THEME: 'theme',
        BACKUP_PREFIX: 'tasks_backup_',
        BACKUP_COUNTER: 'backupCounter'
    },
    AUTO_SAVE_INTERVAL: 2000,
    MAX_BACKUPS: 5,
    BACKUP_EVERY_N_SAVES: 5,
    DATA_VERSION: '1.0'
};

const TaskStore = {
    tasks: [],
    dirty: false,
    _saveCounter: 0,

    add(text, group, tag) {
        const task = {
            id: crypto.randomUUID(),
            text,
            group: group || '',
            tag: tag || '',
            completed: false
        };
        this.tasks.push(task);
        this.markDirty();
        return task;
    },

    update(id, text, group, tag) {
        const task = this.findById(id);
        if (!task) return null;
        task.text = text;
        task.group = group || '';
        task.tag = tag || '';
        this.markDirty();
        return task;
    },

    toggleComplete(id) {
        const task = this.findById(id);
        if (!task) return null;
        task.completed = !task.completed;
        this.markDirty();
        return task;
    },

    remove(id) {
        const index = this.tasks.findIndex(t => t.id === id);
        if (index === -1) return false;
        this.tasks.splice(index, 1);
        this.markDirty();
        return true;
    },

    removeCompleted() {
        const before = this.tasks.length;
        this.tasks = this.tasks.filter(t => !t.completed);
        if (this.tasks.length !== before) this.markDirty();
        return before - this.tasks.length;
    },

    findById(id) {
        return this.tasks.find(t => t.id === id) || null;
    },

    getAll() {
        return [...this.tasks];
    },

    filter({ group, tag, searchTerm } = {}) {
        const _group = group || 'all';
        const _tag = tag || 'all';
        const _search = (searchTerm || '').toLowerCase().trim();

        return this.tasks.filter(task => {
            const groupMatch = _group === 'all' || task.group === _group;
            const tagMatch = _tag === 'all' || task.tag === _tag;
            const searchMatch = !_search ||
                task.text.toLowerCase().includes(_search) ||
                task.group.toLowerCase().includes(_search) ||
                task.tag.toLowerCase().includes(_search);
            return groupMatch && tagMatch && searchMatch;
        });
    },

    markDirty() {
        this.dirty = true;
    },

    save() {
        try {
            if (!this.dirty) return true;
            const taskData = {
                version: CONFIG.DATA_VERSION,
                lastUpdated: new Date().toISOString(),
                tasks: this.tasks
            };
            localStorage.setItem(CONFIG.STORAGE_KEYS.TASKS, JSON.stringify(taskData));
            this.dirty = false;
            this._incrementBackupCounter();
            return true;
        } catch (error) {
            console.error('保存任务失败:', error);
            return false;
        }
    },

    load() {
        try {
            const taskDataStr = localStorage.getItem(CONFIG.STORAGE_KEYS.TASKS);
            if (!taskDataStr) {
                this.tasks = [];
                return true;
            }

            try {
                const taskData = JSON.parse(taskDataStr);
                this.tasks = Array.isArray(taskData.tasks) ? taskData.tasks : (Array.isArray(taskData) ? taskData : []);
                this._ensureIds();
            } catch (parseError) {
                console.error('解析任务数据失败，尝试从备份恢复:', parseError);
                if (!this.restoreFromBackup()) {
                    this.tasks = [];
                }
            }
            this.dirty = false;
            return true;
        } catch (error) {
            console.error('加载任务失败:', error);
            this.tasks = [];
            return false;
        }
    },

    _ensureIds() {
        this.tasks.forEach(task => {
            if (!task.id) task.id = crypto.randomUUID();
        });
    },

    _incrementBackupCounter() {
        try {
            this._saveCounter++;
            if (this._saveCounter % CONFIG.BACKUP_EVERY_N_SAVES === 0) {
                this.createBackup();
            }
        } catch (error) {
            console.error('更新备份计数器失败:', error);
        }
    },

    createBackup() {
        try {
            const currentData = localStorage.getItem(CONFIG.STORAGE_KEYS.TASKS);
            if (!currentData) return;

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            localStorage.setItem(`${CONFIG.STORAGE_KEYS.BACKUP_PREFIX}${timestamp}`, currentData);

            const backups = Object.keys(localStorage)
                .filter(key => key.startsWith(CONFIG.STORAGE_KEYS.BACKUP_PREFIX))
                .sort()
                .reverse();

            backups.slice(CONFIG.MAX_BACKUPS).forEach(key => localStorage.removeItem(key));
        } catch (error) {
            console.error('创建备份失败:', error);
        }
    },

    restoreFromBackup() {
        try {
            const backups = Object.keys(localStorage)
                .filter(key => key.startsWith(CONFIG.STORAGE_KEYS.BACKUP_PREFIX))
                .sort()
                .reverse();

            if (backups.length === 0) return false;

            const backupData = localStorage.getItem(backups[0]);
            if (!backupData) return false;

            localStorage.setItem(CONFIG.STORAGE_KEYS.TASKS, backupData);
            this.load();
            return true;
        } catch (error) {
            console.error('恢复备份失败:', error);
            return false;
        }
    },

    exportJSON() {
        return {
            version: CONFIG.DATA_VERSION,
            exportDate: new Date().toISOString(),
            tasks: this.tasks
        };
    },

    importJSON(jsonString) {
        const data = JSON.parse(jsonString);
        const tasks = Array.isArray(data.tasks) ? data.tasks : (Array.isArray(data) ? data : null);
        if (!tasks) throw new Error('无效的任务数据格式');
        this.tasks = tasks;
        this._ensureIds();
        this.markDirty();
        return tasks.length;
    },

    setupAutoSave(interval) {
        setInterval(() => this.save(), interval || CONFIG.AUTO_SAVE_INTERVAL);
    },

    getTheme() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || 'light';
    },

    setTheme(theme) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, theme);
    }
};

const TaskRenderer = {
    elements: {},

    cacheElements() {
        this.elements = {
            taskInput: document.getElementById('taskInput'),
            addTaskBtn: document.getElementById('addTaskBtn'),
            taskList: document.getElementById('taskList'),
            groupSelector: document.querySelector('.search-container .group-selector'),
            tagSelector: document.querySelector('.search-container .tag-selector'),
            modal: document.getElementById('addTaskModal'),
            closeBtn: document.querySelector('.close'),
            modalGroupSelector: document.getElementById('modalGroupSelector'),
            modalTagSelector: document.getElementById('modalTagSelector'),
            modalTaskInput: document.getElementById('modalTaskInput'),
            modalAddTaskBtn: document.getElementById('modalAddTaskBtn'),
            modalTitle: document.getElementById('modalTitle'),
            modalTaskId: document.getElementById('modalTaskId'),
            searchInput: document.getElementById('searchInput'),
            clearSearchBtn: document.getElementById('clearSearchBtn'),
            themeToggle: document.getElementById('themeToggle'),
            confirmModal: document.getElementById('confirmModal'),
            confirmMessage: document.getElementById('confirmMessage'),
            confirmOkBtn: document.getElementById('confirmOkBtn'),
            confirmCancelBtn: document.getElementById('confirmCancelBtn')
        };
    },

    renderList(tasks, searchTerm) {
        const { taskList } = this.elements;
        if (!taskList) return;

        taskList.innerHTML = '';

        if (tasks.length === 0) {
            this.showEmptyState(taskList);
            return;
        }

        const fragment = document.createDocumentFragment();
        tasks.forEach(task => {
            const el = this.createTaskElement(task, searchTerm);
            if (el) fragment.appendChild(el);
        });
        taskList.appendChild(fragment);
    },

    createTaskElement(task, searchTerm) {
        const taskItem = document.createElement('li');
        taskItem.className = 'task-item' + (task.completed ? ' completed' : '');
        taskItem.dataset.id = task.id;
        taskItem.dataset.group = task.group || '';
        taskItem.dataset.tag = task.tag || '';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = !!task.completed;

        const span = document.createElement('span');
        span.className = 'task-text';
        if (searchTerm) {
            span.innerHTML = this.highlightText(task.text, searchTerm);
        } else {
            span.textContent = task.text;
        }

        const meta = document.createElement('div');
        meta.className = 'task-meta';
        if (task.group && task.group !== 'all') {
            const groupTag = document.createElement('span');
            groupTag.className = 'group-tag group-tag-group';
            groupTag.textContent = task.group;
            meta.appendChild(groupTag);
        }
        if (task.tag && task.tag !== 'all') {
            const tagTag = document.createElement('span');
            tagTag.className = 'group-tag group-tag-tag';
            tagTag.textContent = task.tag;
            meta.appendChild(tagTag);
        }

        const actions = document.createElement('div');
        actions.className = 'task-actions';
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.dataset.action = 'edit';
        editBtn.textContent = '编辑';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.dataset.action = 'delete';
        deleteBtn.textContent = '删除';
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        taskItem.appendChild(checkbox);
        taskItem.appendChild(span);
        taskItem.appendChild(meta);
        taskItem.appendChild(actions);

        return taskItem;
    },

    animateTaskIn(taskId) {
        const el = this.elements.taskList?.querySelector(`.task-item[data-id="${taskId}"]`);
        if (el) {
            requestAnimationFrame(() => el.classList.add('task-added'));
        }
    },

    appendStringChild(taskElement) {
        const { taskList } = this.elements;
        if (taskList && taskElement) {
            taskList.appendChild(taskElement);
        }
    },

    showEmptyState(container) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.innerHTML = `
            <div class="empty-state-icon">📋</div>
            <div class="empty-state-text">暂无任务</div>
            <div class="empty-state-hint">点击「添加任务」开始规划你的待办事项</div>
        `;
        container.appendChild(emptyDiv);
    },

    removeEmptyState() {
        const { taskList } = this.elements;
        const existing = taskList?.querySelector('.empty-state');
        if (existing) existing.remove();
    },

    updateStats(tasks) {
        const { taskList } = this.elements;
        if (!taskList) return;

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.completed).length;
        const remainingTasks = totalTasks - completedTasks;
        const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        let statsElement = document.getElementById('taskStats');
        if (!statsElement) {
            statsElement = document.createElement('div');
            statsElement.id = 'taskStats';
            statsElement.className = 'task-stats';
            taskList.parentNode.insertBefore(statsElement, taskList);
        }

        statsElement.innerHTML = `
            <div class="stats-info">
                <span>总计 <span class="stat-number">${totalTasks}</span></span>
                <span>已完成 <span class="stat-number">${completedTasks}</span></span>
                <span>剩余 <span class="stat-number">${remainingTasks}</span></span>
                <span>${percentage}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
        `;
    },

    applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    },

    initializeSelectors() {
        const { groupSelector, modalGroupSelector, tagSelector, modalTagSelector } = this.elements;

        CONFIG.GROUPS.forEach(group => {
            if (groupSelector) this._addOption(groupSelector, group);
            if (modalGroupSelector) this._addOption(modalGroupSelector, group);
        });

        CONFIG.TAGS.forEach(tag => {
            if (tagSelector) this._addOption(tagSelector, tag);
            if (modalTagSelector) this._addOption(modalTagSelector, tag);
        });
    },

    _addOption(select, value) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    },

    openModalForAdd() {
        const { modal, modalTitle, modalTaskInput, modalGroupSelector, modalTagSelector, modalTaskId } = this.elements;
        if (!modal || !modalTitle || !modalTaskInput || !modalTaskId) return;

        modalTitle.textContent = '添加新任务';
        modalTaskId.value = '';
        modalTaskInput.value = '';
        if (modalGroupSelector) modalGroupSelector.value = 'all';
        if (modalTagSelector) modalTagSelector.value = 'all';
        this.ensureModalActionsContainer();
        modal.style.display = 'block';
    },

    openModalForEdit(task) {
        const { modal, modalTitle, modalTaskInput, modalGroupSelector, modalTagSelector, modalTaskId } = this.elements;
        if (!modal || !modalTitle || !modalTaskInput || !modalTaskId) return;

        modalTitle.textContent = '编辑任务';
        modalTaskInput.value = task.text;
        if (modalGroupSelector) modalGroupSelector.value = task.group || 'all';
        if (modalTagSelector) modalTagSelector.value = task.tag || 'all';
        modalTaskId.value = task.id;
        this.ensureModalActionsContainer();
        modal.style.display = 'block';
    },

    closeModal() {
        const { modal, modalTaskInput } = this.elements;
        if (modal) modal.style.display = 'none';
        if (modalTaskInput) modalTaskInput.value = '';
    },

    ensureModalActionsContainer() {
        const { modalAddTaskBtn, modal } = this.elements;
        if (!modalAddTaskBtn || !modal) return;

        let actionsContainer = modal.querySelector('.modal-actions');
        if (!actionsContainer) {
            actionsContainer = document.createElement('div');
            actionsContainer.className = 'modal-actions';

            const parent = modalAddTaskBtn.parentNode;
            if (parent) {
                parent.removeChild(modalAddTaskBtn);
                actionsContainer.appendChild(modalAddTaskBtn);

                const modalContent = modal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.appendChild(actionsContainer);
                }
            }
        }
    },

    showConfirm(message) {
        const { confirmModal, confirmMessage } = this.elements;
        if (!confirmModal || !confirmMessage) {
            return Promise.resolve(window.confirm(message));
        }
        confirmMessage.textContent = message;
        confirmModal.style.display = 'block';
        return new Promise((resolve) => {
            this._confirmResolve = resolve;
        });
    },

    _confirmResolve: null,

    highlightText(text, keyword) {
        if (!keyword) return text;
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    },

    addClearCompletedButton() {
        const { addTaskBtn } = this.elements;
        if (!addTaskBtn) return;

        let buttonContainer = document.querySelector('.button-container');
        if (!buttonContainer) {
            const parentContainer = addTaskBtn.parentNode;
            buttonContainer = document.createElement('div');
            buttonContainer.className = 'button-container';
            parentContainer.removeChild(addTaskBtn);
            parentContainer.appendChild(buttonContainer);
            buttonContainer.appendChild(addTaskBtn);
        }

        let clearBtn = document.getElementById('clearCompletedBtn');
        if (!clearBtn) {
            clearBtn = document.createElement('button');
            clearBtn.id = 'clearCompletedBtn';
            clearBtn.textContent = '清空已完成';
            clearBtn.className = 'clear-btn';
            clearBtn.dataset.action = 'clear-completed';
            buttonContainer.appendChild(clearBtn);
        }
    },

    addDataManagementButtons() {
        const { taskList } = this.elements;
        if (!taskList) return;

        let dataMgmtContainer = document.getElementById('dataManagementContainer');
        if (dataMgmtContainer) return;

        dataMgmtContainer = document.createElement('div');
        dataMgmtContainer.id = 'dataManagementContainer';
        dataMgmtContainer.className = 'data-management';

        const restoreBtn = document.createElement('button');
        restoreBtn.id = 'restoreBackupBtn';
        restoreBtn.textContent = '恢复备份';
        restoreBtn.className = 'data-btn';
        restoreBtn.dataset.action = 'restore-backup';

        const exportBtn = document.createElement('button');
        exportBtn.id = 'exportBtn';
        exportBtn.textContent = '导出任务';
        exportBtn.className = 'data-btn';
        exportBtn.dataset.action = 'export';

        const importContainer = document.createElement('div');
        importContainer.className = 'import-container';

        const importBtn = document.createElement('button');
        importBtn.id = 'importBtn';
        importBtn.textContent = '导入任务';
        importBtn.className = 'data-btn';
        importBtn.dataset.action = 'import';

        const importInput = document.createElement('input');
        importInput.type = 'file';
        importInput.id = 'importInput';
        importInput.accept = '.json';
        importInput.style.display = 'none';

        importContainer.appendChild(importBtn);
        importContainer.appendChild(importInput);

        dataMgmtContainer.appendChild(restoreBtn);
        dataMgmtContainer.appendChild(exportBtn);
        dataMgmtContainer.appendChild(importContainer);

        const statsElement = document.getElementById('taskStats');
        if (statsElement) {
            taskList.parentNode.insertBefore(dataMgmtContainer, statsElement.nextSibling);
        } else {
            taskList.parentNode.insertBefore(dataMgmtContainer, taskList);
        }
    },

    deleteTaskElement(taskId) {
        const el = this.elements.taskList?.querySelector(`.task-item[data-id="${taskId}"]`);
        if (!el) return;

        el.style.transition = 'all 0.3s ease';
        el.style.opacity = '0';
        el.style.transform = 'translateX(50px)';

        setTimeout(() => {
            try {
                if (el.parentNode) el.parentNode.removeChild(el);
            } catch (error) {
                console.error('删除任务元素时发生错误:', error);
            }
        }, 300);
    },

    clearCompletedElements() {
        const completedEls = this.elements.taskList?.querySelectorAll('.task-item.completed') || [];
        completedEls.forEach(el => {
            el.style.transition = 'all 0.3s ease';
            el.style.opacity = '0';
            el.style.transform = 'translateX(50px)';
        });
        return new Promise(resolve => setTimeout(resolve, 300));
    }
};

const TaskController = {
    init() {
        TaskRenderer.cacheElements();
        TaskStore.load();

        const theme = TaskStore.getTheme();
        TaskRenderer.applyTheme(theme);
        TaskRenderer.initializeSelectors();
        TaskRenderer.addClearCompletedButton();
        TaskRenderer.addDataManagementButtons();

        this.bindEvents();
        this.bindConfirmDelegation();

        const tasks = TaskStore.getAll();
        TaskRenderer.renderList(tasks);
        TaskRenderer.updateStats(tasks);

        TaskStore.setupAutoSave();
    },

    bindEvents() {
        const { themeToggle, addTaskBtn, closeBtn, modal, modalAddTaskBtn, modalTaskInput,
                taskInput, groupSelector, tagSelector, searchInput, clearSearchBtn,
                modalGroupSelector, modalTagSelector, modalTitle, modalTaskId, taskList } = TaskRenderer.elements;

        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.handleToggleTheme());
        }

        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => TaskRenderer.openModalForAdd());
        }

        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => TaskRenderer.closeModal());
        }

        if (modal) {
            window.addEventListener('click', (e) => {
                if (e.target === modal) TaskRenderer.closeModal();
            });
        }

        if (modalAddTaskBtn) {
            modalAddTaskBtn.addEventListener('click', () => this.handleModalSubmit());
        }

        if (modalTaskInput) {
            modalTaskInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleModalSubmit();
            });
        }

        if (taskInput) {
            taskInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleQuickAdd();
            });
        }

        if (groupSelector) {
            groupSelector.addEventListener('change', () => this.handleFilter());
        }

        if (tagSelector) {
            tagSelector.addEventListener('change', () => this.handleFilter());
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => this.handleSearch());
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    this.handleSearch();
                }
            });
        }

        if (clearSearchBtn && searchInput) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                this.handleSearch();
                searchInput.focus();
            });
        }

        if (taskList) {
            taskList.addEventListener('click', (e) => this.handleTaskListClick(e));
            taskList.addEventListener('change', (e) => this.handleTaskListChange(e));
        }

        document.addEventListener('click', (e) => this.handleDataManagementClick(e));

        this.bindKeyboardShortcuts();
    },

    bindConfirmDelegation() {
        const { confirmModal, confirmOkBtn, confirmCancelBtn } = TaskRenderer.elements;
        if (!confirmModal || !confirmOkBtn || !confirmCancelBtn) return;

        const close = (result) => {
            confirmModal.style.display = 'none';
            if (TaskRenderer._confirmResolve) {
                TaskRenderer._confirmResolve(result);
                TaskRenderer._confirmResolve = null;
            }
        };

        confirmOkBtn.addEventListener('click', () => close(true));
        confirmCancelBtn.addEventListener('click', () => close(false));
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) close(false);
        });
    },

    handleToggleTheme() {
        const isDark = document.body.classList.toggle('dark-mode');
        const theme = isDark ? 'dark' : 'light';
        TaskStore.setTheme(theme);
        TaskRenderer.applyTheme(theme);
    },

    handleQuickAdd() {
        const { taskInput, groupSelector, tagSelector } = TaskRenderer.elements;
        if (!taskInput) return;

        const text = taskInput.value.trim();
        if (!text) return;

        const group = groupSelector?.value || 'all';
        const tag = tagSelector?.value || 'all';
        TaskStore.add(text, group, tag);

        taskInput.value = '';
        this.handleFilter();
    },

    handleModalSubmit() {
        const { modalTaskInput, modalGroupSelector, modalTagSelector, modalTaskId,
                modal, modalAddTaskBtn, modalTitle } = TaskRenderer.elements;
        if (!modalTaskInput || !modalGroupSelector || !modalTagSelector || !modalTaskId || !modal) return;

        const text = modalTaskInput.value.trim();
        if (!text) return;

        const group = modalGroupSelector.value;
        const tag = modalTagSelector.value;
        const taskId = modalTaskId.value;

        if (taskId) {
            TaskStore.update(taskId, text, group, tag);
        } else {
            TaskStore.add(text, group, tag);
        }

        TaskRenderer.closeModal();
        this.handleFilter();
    },

    async handleDeleteTask(taskId) {
        const confirmed = await TaskRenderer.showConfirm('确定要删除这个任务吗？');
        if (!confirmed) return;

        TaskStore.remove(taskId);
        TaskRenderer.deleteTaskElement(taskId);

        setTimeout(() => {
            TaskRenderer.updateStats(TaskStore.getAll());
            if (TaskStore.getAll().length === 0) {
                const { taskList } = TaskRenderer.elements;
                if (taskList && !taskList.querySelector('.task-item')) {
                    taskList.innerHTML = '';
                    TaskRenderer.showEmptyState(taskList);
                }
            }
        }, 350);
    },

    handleEditTask(taskId) {
        const task = TaskStore.findById(taskId);
        if (!task) return;
        TaskRenderer.openModalForEdit(task);
    },

    handleToggleTask(taskId) {
        TaskStore.toggleComplete(taskId);
        const el = TaskRenderer.elements.taskList?.querySelector(`.task-item[data-id="${taskId}"]`);
        if (el) {
            const task = TaskStore.findById(taskId);
            if (task) {
                el.classList.toggle('completed', task.completed);
                const checkbox = el.querySelector('.task-checkbox');
                if (checkbox) checkbox.checked = task.completed;
            }
        }
        TaskRenderer.updateStats(TaskStore.getAll());
    },

    handleTaskListClick(e) {
        const target = e.target;
        const taskItem = target.closest('.task-item');
        if (!taskItem) return;

        const taskId = taskItem.dataset.id;
        if (!taskId) return;

        const action = target.dataset.action;
        if (action === 'edit') {
            this.handleEditTask(taskId);
        } else if (action === 'delete') {
            if (!target.disabled) {
                target.disabled = true;
                this.handleDeleteTask(taskId);
            }
        }
    },

    handleTaskListChange(e) {
        const target = e.target;
        if (!target.classList.contains('task-checkbox')) return;

        const taskItem = target.closest('.task-item');
        if (!taskItem) return;

        const taskId = taskItem.dataset.id;
        if (!taskId) return;

        const task = TaskStore.findById(taskId);
        if (task && task.completed !== target.checked) {
            this.handleToggleTask(taskId);
        }
    },

    handleFilter() {
        const { groupSelector, tagSelector, searchInput } = TaskRenderer.elements;
        const group = groupSelector?.value || 'all';
        const tag = tagSelector?.value || 'all';
        const searchTerm = searchInput?.value || '';

        const filtered = TaskStore.filter({ group, tag, searchTerm });
        TaskRenderer.renderList(filtered, searchTerm);
        TaskRenderer.updateStats(filtered);
    },

    handleSearch() {
        const { searchInput, clearSearchBtn } = TaskRenderer.elements;
        if (clearSearchBtn && searchInput) {
            clearSearchBtn.classList.toggle('active', searchInput.value.trim() !== '');
        }
        this.handleFilter();
    },

    async handleDataManagementClick(e) {
        const action = e.target.dataset.action;
        if (!action) return;

        if (action === 'clear-completed') {
            if (e.target.disabled) return;
            const confirmed = await TaskRenderer.showConfirm('确定要清空所有已完成的任务吗？');
            if (!confirmed) return;

            e.target.disabled = true;
            await TaskRenderer.clearCompletedElements();
            TaskStore.removeCompleted();
            const tasks = TaskStore.getAll();
            TaskRenderer.renderList(tasks);
            TaskRenderer.updateStats(tasks);
            e.target.disabled = false;
        }

        if (action === 'restore-backup') {
            const confirmed = await TaskRenderer.showConfirm('确定要从备份恢复任务吗？这将覆盖当前的所有任务。');
            if (!confirmed) return;

            if (TaskStore.restoreFromBackup()) {
                const tasks = TaskStore.getAll();
                TaskRenderer.renderList(tasks);
                TaskRenderer.updateStats(tasks);
                alert('任务已从备份恢复');
            } else {
                alert('没有找到可用的备份');
            }
        }

        if (action === 'export') {
            const data = TaskStore.exportJSON();
            const dataStr = JSON.stringify(data, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const fileName = `todo_export_${new Date().toISOString().split('T')[0]}.json`;
            const link = document.createElement('a');
            link.setAttribute('href', dataUri);
            link.setAttribute('download', fileName);
            link.click();
        }

        if (action === 'import') {
            const importInput = document.getElementById('importInput');
            if (importInput) importInput.click();
        }
    },

    bindKeyboardShortcuts() {
        const { searchInput } = TaskRenderer.elements;

        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey &&
                !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
                e.preventDefault();
                if (searchInput) searchInput.focus();
            }

            if (e.key === 'Escape' && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                e.target.value = '';
                if (e.target.id === 'searchInput') this.handleSearch();
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.handleQuickAdd();
            }

            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X') {
                const taskItem = e.target.closest('.task-item');
                if (taskItem) {
                    e.preventDefault();
                    const taskId = taskItem.dataset.id;
                    if (taskId) this.handleToggleTask(taskId);
                }
            }
        });

        const importInput = document.getElementById('importInput');
        if (importInput) {
            importInput.addEventListener('change', async (e) => {
                if (!e.target.files || !e.target.files[0]) return;

                const confirmed = await TaskRenderer.showConfirm('确定要导入任务吗？这将覆盖当前的所有任务。');
                if (!confirmed) {
                    e.target.value = '';
                    return;
                }

                try {
                    const text = await e.target.files[0].text();
                    TaskStore.importJSON(text);
                    TaskStore.save();
                    const tasks = TaskStore.getAll();
                    TaskRenderer.renderList(tasks);
                    TaskRenderer.updateStats(tasks);
                    alert('任务导入成功');
                } catch (error) {
                    alert('任务导入失败: ' + error.message);
                }
                e.target.value = '';
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    TaskController.init();
});
