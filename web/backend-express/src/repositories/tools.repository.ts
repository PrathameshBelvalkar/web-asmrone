import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { writeFileAtomic } from '../lib/atomic-file.js';
import { Mutex } from '../lib/mutex.js';

/** What the speech-engine setup chose. A missing or corrupt file means nothing is chosen yet. */
export interface ToolsState {
  readonly modelId?: string;
  readonly variant?: 'metal' | 'cpu' | 'system';
  readonly speedFactor?: number;
  readonly benchmarkedAt?: string;
  /** True once the user picked the model in Settings (then the automatic step-down never runs). */
  readonly modelPickedByUser?: boolean;
  /** True once the automatic step-down to the small model happened (it happens at most once). */
  readonly steppedDown?: boolean;
  /** A model whose download finished and still needs its speed test (the step-down download). */
  readonly benchmarkPending?: string;
  /** The user paused a download; it does not resume by itself. */
  readonly paused?: boolean;
  /** The model whose download was paused (its partial file is kept). */
  readonly pausedModelId?: string;
}

const stateSchema = z.object({
  modelId: z.string().optional(),
  variant: z.enum(['metal', 'cpu', 'system']).optional(),
  speedFactor: z.number().optional(),
  benchmarkedAt: z.string().optional(),
  modelPickedByUser: z.boolean().optional(),
  steppedDown: z.boolean().optional(),
  benchmarkPending: z.string().optional(),
  paused: z.boolean().optional(),
  pausedModelId: z.string().optional(),
});

/** `tools.json` in the data folder. Writes are atomic and one at a time. */
export class ToolsRepository {
  private state: ToolsState;
  private readonly saveLock = new Mutex();

  constructor(private readonly file: string) {
    this.state = loadState(file);
  }

  get(): ToolsState {
    return this.state;
  }

  async update(patch: ToolsState): Promise<void> {
    this.state = { ...this.state, ...patch };
    const data = JSON.stringify(this.state, null, 2);
    await this.saveLock.run(() => writeFileAtomic(this.file, data));
  }
}

function loadState(file: string): ToolsState {
  try {
    const parsed = stateSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}
