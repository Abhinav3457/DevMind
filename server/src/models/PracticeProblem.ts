import mongoose, { Document, Schema } from 'mongoose';

export type PracticeDifficulty = 'easy' | 'medium' | 'hard';

export interface PracticeExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface PracticeTestCase {
  input: string;
  expectedOutput: string;
  hidden?: boolean;
}

export interface IPracticeProblem extends Document {
  slug: string;
  title: string;
  difficulty: PracticeDifficulty;
  category: string;
  description: string;
  examples: PracticeExample[];
  constraints: string[];
  hints: string[];
  functionName: string;
  starterCode: Record<string, string>;
  testCases: PracticeTestCase[];
  tags: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const exampleSchema = new Schema<PracticeExample>(
  {
    input: { type: String, required: true },
    output: { type: String, required: true },
    explanation: { type: String, default: '' },
  },
  { _id: false },
);

const testCaseSchema = new Schema<PracticeTestCase>(
  {
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    hidden: { type: Boolean, default: false },
  },
  { _id: false },
);

const practiceProblemSchema = new Schema<IPracticeProblem>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true, index: true },
    category: { type: String, required: true, index: true },
    description: { type: String, required: true },
    examples: { type: [exampleSchema], default: [] },
    constraints: { type: [String], default: [] },
    hints: { type: [String], default: [] },
    functionName: { type: String, required: true },
    starterCode: { type: Schema.Types.Mixed, default: {} },
    testCases: { type: [testCaseSchema], default: [] },
    tags: { type: [String], default: [] },
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

const PracticeProblem = mongoose.model<IPracticeProblem>('PracticeProblem', practiceProblemSchema);
export default PracticeProblem;
