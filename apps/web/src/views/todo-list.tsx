import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { cn } from '../lib/utils.js';
import type { TodosResponse, TodoItem } from '@panorama/shared';

export function TodoListView() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<TodosResponse>('/todos');
      setTodos(data.todos);
    } catch (err) {
      console.error('Failed to load todos:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addTodo = async () => {
    if (!newText.trim() || adding) return;
    setAdding(true);
    try {
      await apiFetch('/todos', {
        method: 'POST',
        body: JSON.stringify({ text: newText.trim() }),
      });
      setNewText('');
      await load();
    } catch (err) {
      console.error('Failed to add todo:', err);
    }
    setAdding(false);
  };

  const toggleComplete = async (id: number, completed: boolean) => {
    try {
      await apiFetch(`/todos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !completed }),
      });
      await load();
    } catch (err) {
      console.error('Failed to toggle todo:', err);
    }
  };

  const deleteTodo = async (id: number) => {
    try {
      await apiFetch(`/todos/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      console.error('Failed to delete todo:', err);
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a new todo..."
          className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
        <button
          onClick={addTodo}
          disabled={adding || !newText.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--color-muted)]">Loading...</div>
      ) : todos.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-muted)]">
          <p className="text-sm">No todos yet. Add one above to get started.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleComplete(todo.id, todo.completed)}
                className="h-4 w-4 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)] cursor-pointer"
              />
              <span
                className={cn(
                  'flex-1 text-sm',
                  todo.completed && 'line-through text-[var(--color-muted)]',
                )}
              >
                {todo.text}
              </span>
              <span className="text-xs text-[var(--color-muted)]">
                {new Date(todo.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-red-50 transition-all"
                aria-label="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
