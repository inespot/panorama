import { Briefcase, ListChecks } from 'lucide-react';
import { registerView } from './lib/view-registry.js';
import { DashboardShell } from './components/dashboard-shell.js';
import { ErrorBoundary } from './components/error-boundary.js';
import { OngoingWorkView } from './views/ongoing-work.js';
import { TodoListView } from './views/todo-list.js';

registerView({
  id: 'ongoing-work',
  label: 'Ongoing Work',
  icon: Briefcase,
  component: OngoingWorkView,
});

registerView({
  id: 'todo-list',
  label: 'Todo List',
  icon: ListChecks,
  component: TodoListView,
});

export function App() {
  return (
    <ErrorBoundary>
      <DashboardShell />
    </ErrorBoundary>
  );
}
