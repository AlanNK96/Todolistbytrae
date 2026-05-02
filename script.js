const TodoApp = {
    init() {
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
            modalTaskId: document.getElementById('modalTaskId')
        };

        this.data = {
            groups: ['工作', '学习', '生活'],
            tags: ['重要', '紧急', '日常']
        };

        this.bindEvents();
        this.initializeComponents();

        if (this.isHomePage()) {
            this.loadTasks();
            this.setupAutoSave();
        } else if (this.isAddTaskPage()) {
            this.setupAddTaskPage();
        }
    },

    isHomePage() {
        return window.location.pathname.includes('index.html') || window.location.pathname === '/';
    },

    isAddTaskPage() {
        return window.location.pathname.includes('add-task.html');
    },

    showConfirm(message) {
        return new Promise((resolve) => {
            const confirmModal = document.getElementById('confirmModal');
            const confirmMessage = document.getElementById('confirmMessage');
            const confirmOkBtn = document.getElementById('confirmOkBtn');
            const confirmCancelBtn = document.getElementById('confirmCancelBtn');

            if (!confirmModal || !confirmMessage || !confirmOkBtn || !confirmCancelBtn) {
                resolve(window.confirm(message));
                return;
            }

            confirmMessage.textContent = message;
            confirmModal.style.display = 'block';

            const cleanup = (result) => {
                confirmModal.style.display = 'none';
                confirmOkBtn.removeEventListener('click', onOk);
                confirmCancelBtn.removeEventListener('click', onCancel);
                confirmModal.removeEventListener('click', onBackdrop);
                resolve(result);
            };

            const onOk = () => cleanup(true);
            const onCancel = () => cleanup(false);
            const onBackdrop = (e) => {
                if (e.target === confirmModal) cleanup(false);
            };

            confirmOkBtn.addEventListener('click', onOk);
            confirmCancelBtn.addEventListener('click', onCancel);
            confirmModal.addEventListener('click', onBackdrop);
        });
    },

    bindEvents() {
        const { addTaskBtn, closeBtn, modal, modalAddTaskBtn, modalTaskInput, taskInput, groupSelector, tagSelector, modalTitle, modalTaskId, modalGroupSelector, modalTagSelector } = this.elements;

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        const searchInput = document.getElementById('searchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');

        if (searchInput) {
            searchInput.addEventListener('input', () => this.searchTasks());
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    this.searchTasks();
                }
            });
        }

        if (clearSearchBtn && searchInput) {
            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                this.searchTasks();
                searchInput.focus();
            });
        }

        if (addTaskBtn && modal && modalTitle && modalTaskId) {
            addTaskBtn.addEventListener('click', () => {
                modalTitle.textContent = '添加新任务';
                modalTaskId.value = '';
                modalTaskInput.value = '';
                if (modalGroupSelector) modalGroupSelector.value = 'all';
                if (modalTagSelector) modalTagSelector.value = 'all';
                modal.style.display = 'block';
                this.ensureModalActionsContainer();
            });
        }

        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => modal.style.display = 'none');
        }

        if (modal) {
            window.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
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
                if (e.key === 'Enter') this.addTask();
            });
        }

        if (groupSelector && tagSelector) {
            groupSelector.addEventListener('change', () => this.filterTasks());
            tagSelector.addEventListener('change', () => this.filterTasks());
        }

        this.addKeyboardShortcuts();
    },

    initializeComponents() {
        this.initializeSelectors();
        this.applySavedTheme();

        if (this.isHomePage() && this.elements.addTaskBtn) {
            this.addClearCompletedButton();
            this.addDataManagementButtons();
        }
    },

    toggleTheme() {
        const body = document.body;
        const themeIcon = document.querySelector('.theme-icon');

        body.classList.toggle('dark-mode');

        if (body.classList.contains('dark-mode')) {
            if (themeIcon) themeIcon.textContent = '☀️';
            localStorage.setItem('theme', 'dark');
        } else {
            if (themeIcon) themeIcon.textContent = '🌙';
            localStorage.setItem('theme', 'light');
        }
    },

    applySavedTheme() {
        const savedTheme = localStorage.getItem('theme');
        const themeIcon = document.querySelector('.theme-icon');

        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            if (themeIcon) themeIcon.textContent = '☀️';
        } else {
            if (themeIcon) themeIcon.textContent = '🌙';
        }
    },

    initializeSelectors() {
        const { groupSelector, modalGroupSelector, tagSelector, modalTagSelector } = this.elements;
        const { groups, tags } = this.data;

        groups.forEach(group => {
            if (groupSelector) this.addOptionToSelect(groupSelector, group);
            if (modalGroupSelector) this.addOptionToSelect(modalGroupSelector, group);
        });

        tags.forEach(tag => {
            if (tagSelector) this.addOptionToSelect(tagSelector, tag);
            if (modalTagSelector) this.addOptionToSelect(modalTagSelector, tag);
        });
    },

    addOptionToSelect(selectElement, value) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        selectElement.appendChild(option);
    },

    setupAutoSave() {
        setInterval(() => this.saveTasks(), 2000);
    },

    setupAddTaskPage() {
        const { addTaskBtn, taskInput, groupSelector, tagSelector } = this.elements;
        if (!addTaskBtn || !taskInput || !groupSelector || !tagSelector) return;

        const addTask = () => {
            const taskText = taskInput.value.trim();
            if (taskText === '') return;

            const selectedGroup = groupSelector.value;
            const selectedTag = tagSelector.value;

            const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
            tasks.push({
                text: taskText,
                group: selectedGroup,
                tag: selectedTag,
                completed: false
            });
            localStorage.setItem('tasks', JSON.stringify(tasks));
            window.location.href = 'index.html';
        };

        addTaskBtn.addEventListener('click', addTask);
    },

    addTask() {
        const { taskInput, groupSelector, tagSelector, taskList } = this.elements;
        if (!taskInput || !groupSelector || !tagSelector || !taskList) return;

        const taskText = taskInput.value.trim();
        if (taskText === '') return;

        const selectedGroup = groupSelector.value;
        const selectedTag = tagSelector.value;

        const taskItem = this.createTaskElement(taskText, selectedGroup, selectedTag, false);
        taskList.appendChild(taskItem);
        taskInput.value = '';

        setTimeout(() => taskItem.classList.add('task-added'), 10);

        this.saveTasks();
        this.updateTaskStats(this.getAllTasks());
        this.updateEmptyState();
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

    handleModalSubmit() {
        const { modalTaskInput, modalGroupSelector, modalTagSelector, modalTaskId, taskList, modal, modalAddTaskBtn, modalTitle } = this.elements;
        if (!modalTaskInput || !modalGroupSelector || !modalTagSelector || !modalTaskId || !taskList || !modal || !modalAddTaskBtn || !modalTitle) return;

        const taskText = modalTaskInput.value.trim();
        if (!taskText) return;

        const selectedGroup = modalGroupSelector.value;
        const selectedTag = modalTagSelector.value;
        const taskId = modalTaskId.value;

        if (taskId) {
            this.updateTask(taskId, taskText, selectedGroup, selectedTag);
        } else {
            const taskElement = this.createTaskElement(taskText, selectedGroup, selectedTag, false);
            taskList.appendChild(taskElement);
            setTimeout(() => taskElement.classList.add('task-added'), 10);
        }

        this.saveTasks();
        this.updateTaskStats(this.getAllTasks());
        this.updateEmptyState();

        modal.style.display = 'none';
        modalTaskInput.value = '';
    },

    updateTask(taskId, newText, newGroup, newTag) {
        const taskElement = document.querySelector(`.task-item[data-id="${taskId}"]`);
        if (!taskElement) return;

        const taskTextElement = taskElement.querySelector('.task-text');
        if (taskTextElement) {
            taskTextElement.textContent = newText;
        }

        taskElement.dataset.group = newGroup || '';
        taskElement.dataset.tag = newTag || '';

        const groupTag = taskElement.querySelector('.group-tag-group');
        if (groupTag) {
            groupTag.textContent = newGroup || '';
            groupTag.style.display = newGroup ? '' : 'none';
        }

        const tagTag = taskElement.querySelector('.group-tag-tag');
        if (tagTag) {
            tagTag.textContent = newTag || '';
            tagTag.style.display = newTag ? '' : 'none';
        }

        this.saveTasks();

        taskElement.style.animation = 'none';
        taskElement.offsetHeight;
        taskElement.style.animation = 'fadeIn 0.35s ease';
    },

    deleteTaskElement(taskItem) {
        const { taskList } = this.elements;
        if (!taskList) return;

        taskItem.style.transition = 'all 0.3s ease';
        taskItem.style.opacity = '0';
        taskItem.style.transform = 'translateX(50px)';

        setTimeout(() => {
            try {
                if (taskItem && taskItem.parentNode) {
                    taskItem.parentNode.removeChild(taskItem);
                }
                this.saveTasks();
                this.updateTaskStats(this.getAllTasks());
                this.updateEmptyState();
            } catch (error) {
                console.error('删除任务时发生错误:', error);
                this.saveTasks();
                this.updateTaskStats(this.getAllTasks());
                this.updateEmptyState();
            }
        }, 300);
    },

    createTaskElement(taskText, group, tag, completed = false) {
        const { taskList } = this.elements;
        if (!taskList) return null;

        const taskItem = document.createElement('li');
        taskItem.className = 'task-item';
        taskItem.dataset.group = group;
        taskItem.dataset.tag = tag;

        taskItem.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${completed ? 'checked' : ''}>
            <span class="task-text">${taskText}</span>
            <div class="task-meta">
                ${group && group !== 'all' ? `<span class="group-tag group-tag-group">${group}</span>` : ''}
                ${tag && tag !== 'all' ? `<span class="group-tag group-tag-tag">${tag}</span>` : ''}
            </div>
            <div class="task-actions">
                <button class="edit-btn">编辑</button>
                <button class="delete-btn">删除</button>
            </div>
        `;

        if (completed) {
            taskItem.classList.add('completed');
        }

        const checkbox = taskItem.querySelector('.task-checkbox');
        checkbox.addEventListener('change', () => {
            taskItem.classList.toggle('completed');
            this.saveTasks();
            this.updateTaskStats(this.getAllTasks());
        });

        const taskId = Date.now().toString();
        taskItem.dataset.id = taskId;

        const editBtn = taskItem.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => {
            const { modal, modalTitle, modalTaskInput, modalGroupSelector, modalTagSelector, modalTaskId } = this.elements;
            if (!modal || !modalTitle || !modalTaskInput || !modalGroupSelector || !modalTagSelector || !modalTaskId) return;

            modalTitle.textContent = '编辑任务';
            modalTaskInput.value = taskItem.querySelector('.task-text').textContent;
            modalGroupSelector.value = taskItem.dataset.group || 'all';
            modalTagSelector.value = taskItem.dataset.tag || 'all';
            modalTaskId.value = taskId;

            modal.style.display = 'block';
        });

        const deleteBtn = taskItem.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (deleteBtn.disabled) return;

            const confirmed = await this.showConfirm('确定要删除这个任务吗？');

            if (confirmed) {
                deleteBtn.disabled = true;
                this.deleteTaskElement(taskItem);
            }
        });

        return taskItem;
    },

    updateEmptyState() {
        const { taskList } = this.elements;
        if (!taskList) return;

        const existingEmpty = taskList.querySelector('.empty-state');
        const hasTasks = taskList.querySelectorAll('.task-item').length > 0;

        if (!hasTasks && !existingEmpty) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-state';
            emptyDiv.innerHTML = `
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">暂无任务</div>
                <div class="empty-state-hint">点击「添加任务」开始规划你的待办事项</div>
            `;
            taskList.appendChild(emptyDiv);
        } else if (hasTasks && existingEmpty) {
            existingEmpty.remove();
        }
    },

    addClearCompletedButton() {
        const { addTaskBtn, taskList } = this.elements;
        if (!addTaskBtn || !taskList) return;

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
            clearBtn.addEventListener('click', async () => {
                if (clearBtn.disabled) return;

                const confirmed = await this.showConfirm('确定要清空所有已完成的任务吗？');

                if (confirmed) {
                    clearBtn.disabled = true;

                    const completedTasks = document.querySelectorAll('.task-item.completed');
                    completedTasks.forEach(task => {
                        task.style.transition = 'all 0.3s ease';
                        task.style.opacity = '0';
                        task.style.transform = 'translateX(50px)';
                    });
                    setTimeout(() => {
                        try {
                            completedTasks.forEach(task => {
                                if (task && task.parentNode) {
                                    task.parentNode.removeChild(task);
                                }
                            });
                            this.saveTasks();
                            this.updateTaskStats(this.getAllTasks());
                            this.updateEmptyState();
                        } catch (error) {
                            console.error('清空已完成任务时发生错误:', error);
                            this.saveTasks();
                            this.updateTaskStats(this.getAllTasks());
                            this.updateEmptyState();
                        } finally {
                            if (clearBtn && clearBtn.parentNode) {
                                clearBtn.disabled = false;
                            }
                        }
                    }, 300);
                }
            });
            buttonContainer.appendChild(clearBtn);
        }
    },

    filterTasks() {
        const { groupSelector, tagSelector, taskList } = this.elements;
        if (!groupSelector || !tagSelector || !taskList) return;

        const selectedGroup = groupSelector.value;
        const selectedTag = tagSelector.value;
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        const tasks = taskList.querySelectorAll('.task-item');
        tasks.forEach(task => {
            const taskGroup = task.dataset.group;
            const taskTag = task.dataset.tag;
            const taskText = task.querySelector('.task-text')?.textContent?.toLowerCase() || '';

            const groupMatch = selectedGroup === 'all' || taskGroup === selectedGroup;
            const tagMatch = selectedTag === 'all' || taskTag === selectedTag;
            const searchMatch = searchTerm === '' || taskText.includes(searchTerm) ||
                               taskGroup.toLowerCase().includes(searchTerm) ||
                               taskTag.toLowerCase().includes(searchTerm);

            task.style.display = groupMatch && tagMatch && searchMatch ? '' : 'none';
        });

        this.updateTaskStats(this.getAllTasks());
    },

    searchTasks() {
        const searchInput = document.getElementById('searchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');

        if (!searchInput) return;

        if (clearSearchBtn) {
            clearSearchBtn.classList.toggle('active', searchInput.value.trim() !== '');
        }

        const searchTerm = searchInput.value.toLowerCase().trim();
        const { taskList } = this.elements;

        if (!taskList) return;

        const tasks = taskList.querySelectorAll('.task-item');
        tasks.forEach(task => {
            const taskText = task.querySelector('.task-text')?.textContent?.toLowerCase() || '';
            const taskGroup = task.dataset.group?.toLowerCase() || '';
            const taskTag = task.dataset.tag?.toLowerCase() || '';

            const matchesSearch = searchTerm === '' ||
                                  taskText.includes(searchTerm) ||
                                  taskGroup.includes(searchTerm) ||
                                  taskTag.includes(searchTerm);

            task.style.display = matchesSearch ? '' : 'none';
        });

        this.updateTaskStats(this.getAllTasks());
    },

    addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey &&
                !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
                e.preventDefault();
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.focus();
                }
            }

            if (e.key === 'Escape' && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                e.target.value = '';
                if (e.target.id === 'searchInput') {
                    this.searchTasks();
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && this.isHomePage()) {
                e.preventDefault();
                this.addTask();
            }

            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X' && e.target.closest('.task-item')) {
                e.preventDefault();
                const taskItem = e.target.closest('.task-item');
                const checkbox = taskItem.querySelector('.task-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            }
        });
    },

    getAllTasks() {
        const tasks = [];
        const taskItems = document.querySelectorAll('.task-item');
        taskItems.forEach(task => {
            tasks.push({
                id: task.dataset.id || '',
                text: task.querySelector('.task-text').textContent,
                group: task.dataset.group || '',
                tag: task.dataset.tag || '',
                completed: task.classList.contains('completed')
            });
        });
        return tasks;
    },

    saveTasks() {
        try {
            const taskItems = document.querySelectorAll('.task-item');
            taskItems.forEach(task => {
                if (!task.dataset.id) {
                    task.dataset.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                }
            });

            const tasks = this.getAllTasks();
            const taskData = {
                version: '1.0',
                lastUpdated: new Date().toISOString(),
                tasks: tasks
            };
            localStorage.setItem('tasks', JSON.stringify(taskData));
            this.updateBackupCounter();
            return true;
        } catch (error) {
            console.error('保存任务失败:', error);
            return false;
        }
    },

    updateBackupCounter() {
        try {
            const counter = parseInt(localStorage.getItem('backupCounter') || '0') + 1;
            localStorage.setItem('backupCounter', counter.toString());

            if (counter % 5 === 0) {
                this.createBackup();
            }
        } catch (error) {
            console.error('更新备份计数器失败:', error);
        }
    },

    createBackup() {
        try {
            const currentData = localStorage.getItem('tasks');
            if (currentData) {
                localStorage.setItem('tasks_backup', currentData);
            }
        } catch (error) {
            console.error('创建备份失败:', error);
        }
    },

    restoreFromBackup() {
        try {
            const backupData = localStorage.getItem('tasks_backup');
            if (backupData) {
                localStorage.setItem('tasks', backupData);
                this.loadTasks();
                return true;
            }
            return false;
        } catch (error) {
            console.error('恢复备份失败:', error);
            return false;
        }
    },

    loadTasks() {
        const { taskList } = this.elements;
        if (!taskList) return;

        try {
            const taskDataStr = localStorage.getItem('tasks');
            let tasks = [];

            if (taskDataStr) {
                try {
                    const taskData = JSON.parse(taskDataStr);
                    if (taskData.tasks) {
                        tasks = taskData.tasks;
                    } else {
                        tasks = taskData;
                    }
                } catch (parseError) {
                    console.error('解析任务数据失败，尝试从备份恢复:', parseError);
                    if (this.restoreFromBackup()) {
                        return;
                    }
                    tasks = [];
                }
            }

            taskList.innerHTML = '';

            tasks.forEach(task => {
                const taskText = task.text || '无标题任务';
                const group = task.group || '';
                const tag = task.tag || '';
                const completed = task.completed || false;
                const taskId = task.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);

                const taskItem = this.createTaskElement(taskText, group, tag, completed);

                if (taskItem) {
                    taskItem.dataset.id = taskId;

                    if (completed) {
                        taskItem.classList.add('completed');
                    }

                    taskList.appendChild(taskItem);
                }
            });

            this.updateTaskStats(tasks);
            this.updateEmptyState();
        } catch (error) {
            console.error('加载任务失败:', error);
            taskList.innerHTML = '<li class="task-item">加载任务时出错，请刷新页面重试</li>';
        }
    },

    exportTasks() {
        try {
            const taskData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                tasks: this.getAllTasks()
            };

            const dataStr = JSON.stringify(taskData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

            const exportFileDefaultName = `todo_export_${new Date().toISOString().split('T')[0]}.json`;

            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();

            return true;
        } catch (error) {
            console.error('导出任务失败:', error);
            return false;
        }
    },

    importTasks(file) {
        return new Promise((resolve, reject) => {
            try {
                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        const taskData = JSON.parse(e.target.result);

                        if (!Array.isArray(taskData.tasks) && !Array.isArray(taskData)) {
                            reject(new Error('无效的任务数据格式'));
                            return;
                        }

                        const tasks = Array.isArray(taskData.tasks) ? taskData.tasks : taskData;

                        const newTaskData = {
                            version: '1.0',
                            lastUpdated: new Date().toISOString(),
                            tasks: tasks
                        };
                        localStorage.setItem('tasks', JSON.stringify(newTaskData));

                        this.loadTasks();
                        resolve(true);
                    } catch (parseError) {
                        reject(new Error('解析导入文件失败'));
                    }
                };

                reader.onerror = () => {
                    reject(new Error('读取文件失败'));
                };

                reader.readAsText(file);
            } catch (error) {
                reject(error);
            }
        });
    },

    addDataManagementButtons() {
        const { taskList } = this.elements;
        if (!taskList) return;

        try {
            let dataMgmtContainer = document.getElementById('dataManagementContainer');
            if (!dataMgmtContainer) {
                dataMgmtContainer = document.createElement('div');
                dataMgmtContainer.id = 'dataManagementContainer';
                dataMgmtContainer.className = 'data-management';

                const restoreBtn = document.createElement('button');
                restoreBtn.id = 'restoreBackupBtn';
                restoreBtn.textContent = '恢复备份';
                restoreBtn.className = 'data-btn';
                restoreBtn.addEventListener('click', async () => {
                    const confirmed = await this.showConfirm('确定要从备份恢复任务吗？这将覆盖当前的所有任务。');
                    if (confirmed) {
                        if (this.restoreFromBackup()) {
                            alert('任务已从备份恢复');
                        } else {
                            alert('没有找到可用的备份');
                        }
                    }
                });

                const exportBtn = document.createElement('button');
                exportBtn.id = 'exportBtn';
                exportBtn.textContent = '导出任务';
                exportBtn.className = 'data-btn';
                exportBtn.addEventListener('click', () => {
                    if (this.exportTasks()) {
                        console.log('任务导出成功');
                    } else {
                        alert('任务导出失败');
                    }
                });

                const importContainer = document.createElement('div');
                importContainer.className = 'import-container';

                const importBtn = document.createElement('button');
                importBtn.id = 'importBtn';
                importBtn.textContent = '导入任务';
                importBtn.className = 'data-btn';

                const importInput = document.createElement('input');
                importInput.type = 'file';
                importInput.id = 'importInput';
                importInput.accept = '.json';
                importInput.style.display = 'none';
                importInput.addEventListener('change', async (e) => {
                    if (e.target.files && e.target.files[0]) {
                        const confirmed = await this.showConfirm('确定要导入任务吗？这将覆盖当前的所有任务。');
                        if (confirmed) {
                            try {
                                await this.importTasks(e.target.files[0]);
                                alert('任务导入成功');
                                importInput.value = '';
                            } catch (error) {
                                alert('任务导入失败: ' + error.message);
                            }
                        }
                    }
                });

                importBtn.addEventListener('click', () => {
                    importInput.click();
                });

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
            }
        } catch (error) {
            console.error('添加数据管理按钮失败:', error);
        }
    },

    updateTaskStats(tasks) {
        const { taskList } = this.elements;
        if (!taskList) return;

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(task => task.completed).length;
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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    TodoApp.init();
});
