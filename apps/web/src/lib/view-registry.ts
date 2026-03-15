import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ViewDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  component: ComponentType;
}

const views: ViewDefinition[] = [];

/** Registers a view so it appears in the dashboard navigation. */
export function registerView(view: ViewDefinition): void {
  views.push(view);
}

/** Returns all registered views. */
export function getRegisteredViews(): ViewDefinition[] {
  return views;
}
