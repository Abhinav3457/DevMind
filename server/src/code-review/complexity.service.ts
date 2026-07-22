import { IIndexedFile } from '../models/IndexedFile';

export interface FunctionComplexity {
  name: string;
  file: string;
  startLine: number;
  endLine: number;
  lines: number;
  complexity: number;
  factors: string[];
}

export interface ComplexityReport {
  averageComplexity: number;
  highestComplexity: FunctionComplexity | null;
  complexFunctions: FunctionComplexity[];
  overallRating: 'low' | 'moderate' | 'high' | 'very high';
}

export class ComplexityService {
  private readonly COMPLEXITY_THRESHOLD = 10;
  private readonly HIGH_COMPLEXITY_THRESHOLD = 20;

  analyze(files: IIndexedFile[]): ComplexityReport {
    const allFunctions: FunctionComplexity[] = [];

    for (const file of files) {
      for (const func of file.functions) {
        const complexity = this.calculateComplexity(func.name, func.startLine, func.endLine);
        allFunctions.push({
          name: func.name,
          file: file.path,
          startLine: func.startLine,
          endLine: func.endLine,
          lines: func.endLine - func.startLine + 1,
          complexity,
          factors: this.getComplexityFactors(func.name),
        });
      }
    }

    if (allFunctions.length === 0) {
      return {
        averageComplexity: 1,
        highestComplexity: null,
        complexFunctions: [],
        overallRating: 'low',
      };
    }

    const totalComplexity = allFunctions.reduce((sum, f) => sum + f.complexity, 0);
    const averageComplexity = Math.round((totalComplexity / allFunctions.length) * 10) / 10;

    const complexFunctions = allFunctions
      .filter((f) => f.complexity >= this.COMPLEXITY_THRESHOLD)
      .sort((a, b) => b.complexity - a.complexity);

    const highestComplexity = complexFunctions[0] || null;

    let overallRating: ComplexityReport['overallRating'] = 'low';
    if (averageComplexity >= this.HIGH_COMPLEXITY_THRESHOLD) {
      overallRating = 'very high';
    } else if (averageComplexity >= 15) {
      overallRating = 'high';
    } else if (averageComplexity >= this.COMPLEXITY_THRESHOLD) {
      overallRating = 'moderate';
    }

    return { averageComplexity, highestComplexity, complexFunctions, overallRating };
  }

  private calculateComplexity(name: string, _startLine: number, _endLine: number): number {
    let complexity = 1;
    const lower = name.toLowerCase();

    if (lower.includes('handle') || lower.includes('process') || lower.includes('validate')) {
      complexity += 2;
    }
    if (lower.includes('parse') || lower.includes('transform') || lower.includes('convert')) {
      complexity += 2;
    }
    if (lower.includes('calculate') || lower.includes('compute') || lower.includes('evaluate')) {
      complexity += 3;
    }
    if (lower.includes('authenticate') || lower.includes('authorize') || lower.includes('permission')) {
      complexity += 2;
    }
    if (lower.includes('middleware') || lower.includes('interceptor')) {
      complexity += 2;
    }
    if (lower.includes('connect') || lower.includes('query') || lower.includes('transaction')) {
      complexity += 2;
    }

    const lines = _endLine - _startLine + 1;
    if (lines > 50) complexity += 3;
    else if (lines > 30) complexity += 2;
    else if (lines > 15) complexity += 1;

    return Math.min(complexity, 50);
  }

  private getComplexityFactors(name: string): string[] {
    const factors: string[] = [];
    const lower = name.toLowerCase();

    if (lower.includes('handle') || lower.includes('process')) {
      factors.push('Event handling or processing logic');
    }
    if (lower.includes('validate') || lower.includes('check') || lower.includes('verify')) {
      factors.push('Multiple validation conditions');
    }
    if (lower.includes('parse') || lower.includes('transform') || lower.includes('convert')) {
      factors.push('Data transformation logic');
    }
    if (lower.includes('calculate') || lower.includes('compute')) {
      factors.push('Computational logic');
    }

    return factors;
  }
}

export const complexityService = new ComplexityService();
