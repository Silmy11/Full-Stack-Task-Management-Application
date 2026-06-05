from flask import Flask, render_template, request, jsonify, session, redirect
import sqlite3
import os

app = Flask(__name__)
app.secret_key = 'taskflow_secret_key_2024'
DATABASE = 'tasks.db'

# ---------------- DATABASE INIT ----------------
def init_db():
    if os.path.exists(DATABASE):
        os.remove(DATABASE)

    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            due_date TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    conn.commit()
    conn.close()


# ---------------- DB CONNECTION ----------------
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


# ---------------- PAGES ----------------
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect('/')
    return render_template('dashboard.html', username=session['username'])


# ---------------- REGISTER ----------------
@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()

        if not username or not password:
            return jsonify({'success': False, 'error': 'Username and password required'}), 400

        if len(username) < 3:
            return jsonify({'success': False, 'error': 'Username must be at least 3 characters'}), 400

        if len(password) < 4:
            return jsonify({'success': False, 'error': 'Password must be at least 4 characters'}), 400

        conn = get_db()
        cursor = conn.cursor()

        try:
            cursor.execute(
                'INSERT INTO users (username, password) VALUES (?, ?)',
                (username, password)
            )
            conn.commit()

            user_id = cursor.lastrowid
            conn.close()

            session['user_id'] = user_id
            session['username'] = username

            return jsonify({
                'success': True,
                'message': 'Registration successful',
                'redirect': '/dashboard'
            }), 201

        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'success': False, 'error': 'Username already exists'}), 400

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------- LOGIN ----------------
@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()

        if not username or not password:
            return jsonify({'success': False, 'error': 'Username and password required'}), 400

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            'SELECT id, username, password FROM users WHERE username = ?',
            (username,)
        )
        user = cursor.fetchone()
        conn.close()

        if user and user['password'] == password:
            session['user_id'] = user['id']
            session['username'] = user['username']

            return jsonify({
                'success': True,
                'message': 'Login successful',
                'redirect': '/dashboard'
            }), 200

        return jsonify({'success': False, 'error': 'Invalid username or password'}), 401

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------- LOGOUT ----------------
@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({
        'success': True,
        'message': 'Logged out successfully',
        'redirect': '/'
    }), 200


# ---------------- AUTH CHECK ----------------
@app.route('/check-auth')
def check_auth():
    if 'user_id' in session:
        return jsonify({'success': True, 'username': session['username']}), 200
    return jsonify({'success': False}), 401


# ---------------- GET TASKS ----------------
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    try:
        if 'user_id' not in session:
            return jsonify({'success': False, 'error': 'Not authenticated'}), 401

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute(
            'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
            (session['user_id'],)
        )
        tasks = cursor.fetchall()
        conn.close()

        return jsonify({
            'success': True,
            'tasks': [
                {
                    'id': t['id'],
                    'title': t['title'],
                    'description': t['description'],
                    'priority': t['priority'],
                    'status': t['status'],
                    'created_at': t['created_at'],
                    'due_date': t['due_date']
                }
                for t in tasks
            ]
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------- ADD TASK ----------------
@app.route('/api/tasks', methods=['POST'])
def add_task():
    try:
        if 'user_id' not in session:
            return jsonify({'success': False, 'error': 'Not authenticated'}), 401

        data = request.get_json()

        if not data.get('title'):
            return jsonify({'success': False, 'error': 'Title is required'}), 400

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO tasks (user_id, title, description, priority, due_date)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            session['user_id'],
            data.get('title'),
            data.get('description', ''),
            data.get('priority', 'medium'),
            data.get('due_date', '')
        ))

        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Task added successfully'}), 201

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------- UPDATE TASK ----------------
@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    try:
        if 'user_id' not in session:
            return jsonify({'success': False, 'error': 'Not authenticated'}), 401

        data = request.get_json()
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute('SELECT user_id FROM tasks WHERE id = ?', (task_id,))
        task = cursor.fetchone()

        if not task or task['user_id'] != session['user_id']:
            conn.close()
            return jsonify({'success': False, 'error': 'Task not found'}), 404

        cursor.execute('''
            UPDATE tasks 
            SET title = ?, description = ?, priority = ?, status = ?, due_date = ?
            WHERE id = ? AND user_id = ?
        ''', (
            data.get('title'),
            data.get('description', ''),
            data.get('priority', 'medium'),
            data.get('status', 'pending'),
            data.get('due_date', ''),
            task_id,
            session['user_id']
        ))

        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Task updated successfully'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------- DELETE TASK ----------------
@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    try:
        if 'user_id' not in session:
            return jsonify({'success': False, 'error': 'Not authenticated'}), 401

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute('SELECT user_id FROM tasks WHERE id = ?', (task_id,))
        task = cursor.fetchone()

        if not task or task['user_id'] != session['user_id']:
            conn.close()
            return jsonify({'success': False, 'error': 'Task not found'}), 404

        cursor.execute(
            'DELETE FROM tasks WHERE id = ? AND user_id = ?',
            (task_id, session['user_id'])
        )

        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': 'Task deleted successfully'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ---------------- STATS ----------------
@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        if 'user_id' not in session:
            return jsonify({'success': False, 'error': 'Not authenticated'}), 401

        conn = get_db()
        cursor = conn.cursor()

        user_id = session['user_id']

        cursor.execute('SELECT COUNT(*) FROM tasks WHERE user_id = ?', (user_id,))
        total = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(*) FROM tasks WHERE user_id = ? AND status = "completed"', (user_id,))
        completed = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(*) FROM tasks WHERE user_id = ? AND status = "pending"', (user_id,))
        pending = cursor.fetchone()[0]

        conn.close()

        return jsonify({
            'success': True,
            'total': total,
            'completed': completed,
            'pending': pending
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/debug-tasks')
def debug_tasks():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, title FROM tasks")
    data = cursor.fetchall()
    conn.close()
    return {"tasks": [dict(row) for row in data]}

# ---------------- RUN APP ----------------
if __name__ == '__main__':
    init_db()
    app.run(debug=True)



