import { apiRequest, getDemoModePreference } from './apiClient';
import { ResearchTask } from '../types';
import { DEMO_RESEARCH_TASK } from '../demo/demoData';

export async function fetchResearchTasks(): Promise<ResearchTask[]> {
  if (getDemoModePreference()) {
    return Promise.resolve([DEMO_RESEARCH_TASK]);
  }
  return apiRequest<ResearchTask[]>('/api/v1/agent/tasks');
}

export async function fetchResearchTaskById(taskId: string): Promise<ResearchTask> {
  if (getDemoModePreference()) {
    return Promise.resolve(DEMO_RESEARCH_TASK);
  }
  return apiRequest<ResearchTask>(`/api/v1/agent/tasks/${taskId}`);
}

export async function createResearchTask(
  query: string,
  documentIds: string[]
): Promise<ResearchTask> {
  if (getDemoModePreference()) {
    const newTask: ResearchTask = {
      ...DEMO_RESEARCH_TASK,
      id: `task-${Date.now().toString(36)}`,
      query,
      document_ids: documentIds,
      created_at: new Date().toISOString(),
      status: 'completed',
      progress_pct: 100,
    };
    return Promise.resolve(newTask);
  }

  return apiRequest<ResearchTask>('/api/v1/agent/tasks', {
    method: 'POST',
    body: JSON.stringify({
      query,
      document_ids: documentIds,
    }),
  });
}

