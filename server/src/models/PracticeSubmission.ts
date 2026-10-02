import mongoose, { Document, Schema } from 'mongoose';

export type SubmissionStatus = 'accepted' | 'wrong_answer' | 'needs_review' | 'error';

export interface SubmissionIssue {
  severity: 'critical' | 'major' | 'minor';
  message: string;
  suggestion: string;
}

export interface IPracticeSubmission extends Document {
  userId: mongoose.Types.ObjectId;
  problemId?: mongoose.Types.ObjectId | null;
  source: 'devmind' | 'leetcode';
  problemSlug: string;
  problemTitle: string;
  difficulty: 'easy' | 'medium' | 'hard';
  language: string;
  code: string;
  status: SubmissionStatus;
  score: number;
  passedTests: number;
  totalTests: number;
  timeComplexity: string;
  spaceComplexity: string;
  feedback: string;
  issues: SubmissionIssue[];
  betterApproach: string;
  improvedCode: string;
  durationMs: number;
  createdAt: Date;
}

const issueSchema = new Schema<SubmissionIssue>(
  {
    severity: { type: String, enum: ['critical', 'major', 'minor'], default: 'minor' },
    message: { type: String, default: '' },
    suggestion: { type: String, default: '' },
  },
  { _id: false },
);

const practiceSubmissionSchema = new Schema<IPracticeSubmission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    problemId: { type: Schema.Types.ObjectId, ref: 'PracticeProblem', default: null, index: true },
    source: { type: String, enum: ['devmind', 'leetcode'], default: 'devmind', index: true },
    problemSlug: { type: String, required: true },
    problemTitle: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'easy' },
    language: { type: String, default: 'typescript' },
    code: { type: String, required: true },
    status: {
      type: String,
      enum: ['accepted', 'wrong_answer', 'needs_review', 'error'],
      default: 'needs_review',
    },
    score: { type: Number, default: 0 },
    passedTests: { type: Number, default: 0 },
    totalTests: { type: Number, default: 0 },
    timeComplexity: { type: String, default: 'unknown' },
    spaceComplexity: { type: String, default: 'unknown' },
    feedback: { type: String, default: '' },
    issues: { type: [issueSchema], default: [] },
    betterApproach: { type: String, default: '' },
    improvedCode: { type: String, default: '' },
    durationMs: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

practiceSubmissionSchema.index({ userId: 1, createdAt: -1 });
practiceSubmissionSchema.index({ userId: 1, problemId: 1, status: 1 });

const PracticeSubmission = mongoose.model<IPracticeSubmission>(
  'PracticeSubmission',
  practiceSubmissionSchema,
);
export default PracticeSubmission;
