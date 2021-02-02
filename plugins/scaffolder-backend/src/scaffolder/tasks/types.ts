/*
 * Copyright 2021 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { JsonValue, JsonObject } from '@backstage/config';

export type Status =
  | 'open'
  | 'processing'
  | 'failed'
  | 'cancelled'
  | 'completed';

export type CompletedTaskState = 'failed' | 'completed';

export type DbTaskRow = {
  id: string;
  spec: TaskSpec;
  status: Status;
  lastHeartbeat?: string;
  retryCount: number;
  createdAt: string;
  runId?: string;
};

export type TaskEventType = 'completion' | 'log';
export type DbTaskEventRow = {
  id: number;
  runId: string;
  taskId: string;
  body: JsonObject;
  type: TaskEventType;
  createdAt: string;
};

export type TaskSpec = {
  steps: Array<{
    id: string;
    name: string;
    action: string;
    parameters?: { [name: string]: JsonValue };
  }>;
};

export type DispatchResult = {
  taskId: string;
};

export interface Task {
  spec: TaskSpec;
  emitLog(message: string): Promise<void>;
  complete(result: CompletedTaskState): Promise<void>;
  getWorkspaceName(): Promise<string>;
}

export interface TaskBroker {
  claim(): Promise<Task>;
  dispatch(spec: TaskSpec): Promise<DispatchResult>;
}

export type TaskStoreEmitOptions = {
  taskId: string;
  runId: string;
  body: JsonObject;
  type: TaskEventType;
};

export type TaskStoreGetEventsOptions = {
  taskId: string;
  after?: number | undefined;
};
export interface TaskStore {
  get(taskId: string): Promise<DbTaskRow>;
  createTask(task: TaskSpec): Promise<{ taskId: string }>;
  claimTask(): Promise<DbTaskRow | undefined>;
  heartbeat(runId: string): Promise<void>;
  listStaleTasks(): Promise<{ tasks: DbTaskRow }>;
  setStatus(runId: string, status: Status): Promise<void>;
  emit({ taskId, runId, body, type }: TaskStoreEmitOptions): Promise<void>;
  getEvents({
    taskId,
    after,
  }: TaskStoreGetEventsOptions): Promise<{ events: DbTaskEventRow[] }>;
}
