import mongoose, { Document, Schema } from 'mongoose';

export type AgentToolName = 'search' | 'read_file' | 'list_files' | 'analyze' | 'propose_change';

export interface IAgentStep extends Document {
  order: number;
  tool: AgentToolName;
  params: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed';
  reasoning: string;
  result: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface IAgentPlanStep {
  action: string;
  tool: AgentToolName;
  params: Record<string, unknown>;
}

export interface IAgentChange {
  filePath: string;
  title: string;
  reasoning: string;
  before: string;
  after: string;
}

export interface IAgentSolution {
  summary: string;
  report: string;
  changes: IAgentChange[];
}

export interface IAgentRun extends Document {
  userId: mongoose.Types.ObjectId;
  reportId: mongoose.Types.ObjectId;
  repoName: string;
  task: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  plan: IAgentPlanStep[];
  steps: mongoose.Types.DocumentArray<IAgentStep>;
  solution: IAgentSolution | null;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const agentStepSchema = new Schema<IAgentStep>(
  {
    order: { type: Number, required: true },
    tool: { type: String, enum: ['search', 'read_file', 'list_files', 'analyze', 'propose_change'], required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
    reasoning: { type: String, default: '' },
    result: { type: String, default: '' },
    error: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { _id: true, timestamps: { createdAt: false, updatedAt: false } },
);

const agentRunSchema = new Schema<IAgentRun>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportId: { type: Schema.Types.ObjectId, ref: 'IndexReport', required: true, index: true },
    repoName: { type: String, default: '' },
    task: { type: String, required: true },
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued' },
    plan: {
      type: [
        {
          action: { type: String, default: '' },
          tool: { type: String, enum: ['search', 'read_file', 'list_files', 'analyze', 'propose_change'], required: true },
          params: { type: Schema.Types.Mixed, default: {} },
        },
      ],
      default: [],
    },
    steps: { type: [agentStepSchema], default: [] },
    solution: {
      type: new Schema<IAgentSolution>(
        {
          summary: { type: String, default: '' },
          report: { type: String, default: '' },
          changes: {
            type: [
              {
                filePath: { type: String, required: true },
                title: { type: String, default: '' },
                reasoning: { type: String, default: '' },
                before: { type: String, default: '' },
                after: { type: String, default: '' },
              },
            ],
            default: [],
          },
        },
        { _id: false },
      ),
      default: null,
    },
    error: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true, toJSON: { transform(_doc: Document, ret: Record<string, unknown>) { ret.id = (ret._id as string).toString(); delete ret._id; delete ret.__v; return ret; } } },
);

agentRunSchema.index({ userId: 1, createdAt: -1 });

const AgentRun = mongoose.model<IAgentRun>('AgentRun', agentRunSchema);
export default AgentRun;
