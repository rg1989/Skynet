import { useState, useEffect } from 'react';
import { useStore, type ScheduledTask } from '../store';

export function CronManager() {
  const { tasks, setTasks, addTask, removeTask, updateTask } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', cron: '', prompt: '' });

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.task) {
          addTask(data.task);
        }
        setNewTask({ name: '', cron: '', prompt: '' });
        setShowForm(false);
        fetchTasks();
      }
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleToggle = async (task: ScheduledTask) => {
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !task.enabled }),
      });
      updateTask(task.id, { enabled: !task.enabled });
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this scheduled task?')) return;
    
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      removeTask(taskId);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Scheduled Tasks</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
        >
          {showForm ? 'Cancel' : '+ New Task'}
        </button>
      </div>

      {/* New task form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-800 rounded-lg p-4 mb-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={newTask.name}
              onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
              placeholder="Daily email check"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Cron Schedule</label>
            <input
              type="text"
              value={newTask.cron}
              onChange={(e) => setNewTask({ ...newTask, cron: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
              placeholder="0 9 * * *"
              required
            />
            <div className="text-xs text-gray-500 mt-1">
              Format: minute hour day month weekday (e.g., "0 9 * * *" = 9am daily)
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Prompt</label>
            <textarea
              value={newTask.prompt}
              onChange={(e) => setNewTask({ ...newTask, prompt: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
              rows={3}
              placeholder="Check my emails and summarize any important ones"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-medium"
          >
            Create Task
          </button>
        </form>
      )}

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No scheduled tasks yet
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`bg-gray-800 rounded-lg p-3 ${
                !task.enabled ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(task)}
                    className={`w-4 h-4 rounded border ${
                      task.enabled
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-600'
                    }`}
                  />
                  <span className="font-medium">{task.name}</span>
                </div>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Delete
                </button>
              </div>
              <div className="text-xs text-gray-400 mt-1 font-mono">{task.cron}</div>
              <div className="text-sm text-gray-300 mt-2 truncate">{task.prompt}</div>
              {task.lastRun && (
                <div className="text-xs text-gray-500 mt-1">
                  Last run: {new Date(task.lastRun).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
