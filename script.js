// ========================================
// AUTHENTICATION & TASK MANAGER
// ========================================

// ========================================
// AUTHENTICATION FUNCTIONS
// ========================================

function switchAuthForm(e) {
    e.preventDefault();
    document.getElementById('loginForm').classList.toggle('active');
    document.getElementById('registerForm').classList.toggle('active');
    clearAuthError();
}

function showAuthError(message) {
    const errorEl = document.getElementById('authError');
    errorEl.textContent = message;
    errorEl.classList.add('show');
}

function clearAuthError() {
    const errorEl = document.getElementById('authError');
    errorEl.textContent = '';
    errorEl.classList.remove('show');
}

// Login Form Handler
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showAuthError('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showApp(username);
        } else {
            showAuthError(data.error || 'Login failed');
        }
    } catch (error) {
        showAuthError('Login error. Please try again.');
        console.error('Login error:', error);
    }
});

// Register Form Handler
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    
    if (!username || !password) {
        showAuthError('Please fill in all fields');
        return;
    }
    
    if (username.length < 3) {
        showAuthError('Username must be at least 3 characters');
        return;
    }
    
    if (password.length < 4) {
        showAuthError('Password must be at least 4 characters');
        return;
    }
    
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showApp(username);
        } else {
            showAuthError(data.error || 'Registration failed');
        }
    } catch (error) {
        showAuthError('Registration error. Please try again.');
        console.error('Register error:', error);
    }
});

function showApp(username) {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'flex';
    document.getElementById('userDisplay').textContent = username;
    
    // Initialize task manager
    if (!window.taskManager) {
        window.taskManager = new TaskManager();
    }
}

function checkAuth() {
    fetch('/check-auth')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showApp(data.username);
            }
        })
        .catch(() => {
            // User not authenticated, show login
        });
}

// Logout Handler
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        const response = await fetch('/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            document.getElementById('appScreen').style.display = 'none';
            document.getElementById('authScreen').style.display = 'flex';
            document.getElementById('loginForm').classList.add('active');
            document.getElementById('registerForm').classList.remove('active');
            document.getElementById('loginUsername').value = '';
            document.getElementById('loginPassword').value = '';
            clearAuthError();
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// ========================================
// TASK MANAGER APPLICATION
// ========================================

class TaskManager {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTasks();
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderTasks();
            });
        });
    }

    // ========================================
    // TASK OPERATIONS
    // ========================================

    async loadTasks() {
        try {
            const response = await fetch('/api/tasks');
            const data = await response.json();

            if (data.success) {
                this.tasks = data.tasks;
                this.renderTasks();
                this.updateStats();
            } else if (response.status === 401) {
                console.log('Not authenticated');
            } else {
                this.showError('Failed to load tasks');
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showError('Error loading tasks');
        }
    }

    async addTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const priority = document.getElementById('taskPriority').value;
        const dueDate = document.getElementById('taskDueDate').value;

        if (!title) {
            this.showError('Please enter a task title');
            return;
        }

        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title,
                    description,
                    priority,
                    due_date: dueDate
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Task added successfully!');
                document.getElementById('taskForm').reset();
                this.loadTasks();
            } else {
                this.showError(data.error || 'Failed to add task');
            }
        } catch (error) {
            console.error('Error adding task:', error);
            this.showError('Error adding task');
        }
    }

    async updateTask(id, updates) {
        try {
            const task = this.tasks.find(t => t.id === id);
            const updatedTask = { ...task, ...updates };

            const response = await fetch(`/api/tasks/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedTask)
            });

            const data = await response.json();

            if (data.success) {
                this.loadTasks();
            } else {
                this.showError('Failed to update task');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            this.showError('Error updating task');
        }
    }

    async deleteTask(id) {
        if (!confirm('Are you sure you want to delete this task?')) {
            return;
        }

        try {
            const response = await fetch(`/api/tasks/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Task deleted successfully!');
                this.loadTasks();
            } else {
                this.showError('Failed to delete task');
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showError('Error deleting task');
        }
    }

    // ========================================
    // RENDERING
    // ========================================

    renderTasks() {
        const container = document.getElementById('tasksContainer');
        let filteredTasks = this.tasks;

        // Apply filter
        if (this.currentFilter === 'pending') {
            filteredTasks = this.tasks.filter(t => t.status === 'pending');
        } else if (this.currentFilter === 'completed') {
            filteredTasks = this.tasks.filter(t => t.status === 'completed');
        }

        // Clear container
        container.innerHTML = '';

        // Show empty state if no tasks
        if (filteredTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <p>No tasks found. Create one to get started!</p>
                </div>
            `;
            return;
        }

        // Render tasks
        filteredTasks.forEach((task, index) => {
            const taskElement = this.createTaskElement(task);
            container.appendChild(taskElement);
        });
    }

    createTaskElement(task) {
        const div = document.createElement('div');
        div.className = `task-card ${task.status === 'completed' ? 'completed' : ''}`;
        div.id = `task-${task.id}`;

        const isCompleted = task.status === 'completed';

        // Format date
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const dueDateStr = dueDate ? dueDate.toLocaleDateString() : '';

        div.innerHTML = `
            <input 
                type="checkbox" 
                class="task-checkbox" 
                ${isCompleted ? 'checked' : ''}
                onchange="taskManager.toggleTaskStatus(${task.id}, this.checked)"
            >
            <div class="task-content">
                <div class="task-title">${this.escapeHtml(task.title)}</div>
                ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                <div class="task-meta">
                    <span class="task-priority ${task.priority}">${task.priority}</span>
                    ${dueDateStr ? `<span class="task-due-date">📅 ${dueDateStr}</span>` : ''}
                </div>
            </div>
            <div class="task-actions">
                <button class="btn btn-secondary btn-small" onclick="taskManager.editTask(${task.id})">
                    Edit
                </button>
                <button class="btn btn-danger btn-small" onclick="taskManager.deleteTask(${task.id})">
                    Delete
                </button>
            </div>
        `;

        return div;
    }

    toggleTaskStatus(id, isCompleted) {
        const newStatus = isCompleted ? 'completed' : 'pending';
        this.updateTask(id, { status: newStatus });
    }

    editTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskDueDate').value = task.due_date || '';

        // Scroll to form
        document.querySelector('.add-task-section').scrollIntoView({ behavior: 'smooth' });

        // Highlight form
        const form = document.getElementById('taskForm');
        form.style.borderLeft = '4px solid var(--primary)';
        setTimeout(() => {
            form.style.borderLeft = 'none';
        }, 2000);

        // Update form
        const submitBtn = document.querySelector('.btn-primary');
        const originalText = submitBtn.innerHTML;

        submitBtn.innerHTML = '<span>Update Task</span>';

        form.onsubmit = async (e) => {
            e.preventDefault();

            const title = document.getElementById('taskTitle').value.trim();
            const description = document.getElementById('taskDescription').value.trim();
            const priority = document.getElementById('taskPriority').value;
            const dueDate = document.getElementById('taskDueDate').value;

            if (!title) {
                this.showError('Please enter a task title');
                return;
            }

            await this.updateTask(id, {
                title,
                description,
                priority,
                due_date: dueDate
            });

            form.reset();
            submitBtn.innerHTML = originalText;
            form.onsubmit = (e) => {
                e.preventDefault();
                this.addTask();
            };
            this.showSuccess('Task updated successfully!');
        };
    }

    // ========================================
    // STATS
    // ========================================

    async updateStats() {
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();

            if (data.success) {
                document.getElementById('totalTasks').textContent = data.total;
                document.getElementById('completedTasks').textContent = data.completed;
                document.getElementById('pendingTasks').textContent = data.pending;
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    // ========================================
    // UTILITIES
    // ========================================

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            animation: slideIn 0.3s ease-out;
            z-index: 1000;
            font-weight: 600;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease-out forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
