/**
 * Exact handwritten TypeScript types for the real database schema.
 * Real schema:
 * apps(id, creator_id, name, description, instructions, status 'draft'|'published', created_at, updated_at)
 * app_runs(id, app_id, user_id, input, output, created_at)
 * view published_apps(id, name, description, created_at)
 */

export type AppStatus = 'draft' | 'published';

export interface App {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  instructions: string;
  status: AppStatus;
  created_at: string;
  updated_at: string;
}

export type AppListItem = Pick<App, 'id' | 'name' | 'status' | 'updated_at'>;

export interface AppFormData {
  name: string;
  description: string;
  instructions: string;
}

export interface PublishedApp {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface AppRun {
  id: string;
  app_id: string;
  user_id: string;
  input: string;
  output: string;
  created_at: string;
}
