export type QuestionType =
  | 'project_overview'
  | 'architecture'
  | 'tech_stack'
  | 'code_location'
  | 'file_explain'
  | 'function_explain'
  | 'middleware'
  | 'general';

interface ClassificationResult {
  type: QuestionType;
  keywords: string[];
  targetFile?: string;
  targetFunction?: string;
}

const FILE_PATTERN = /(?:explain|describe|what is|show me)\s+(?:the\s+)?(?:file|code in)\s+([\w./-]+(?:\.[\w]+)?)/i;
const FUNCTION_PATTERN = /(?:explain|describe|what does|how does)\s+(?:the\s+)?(?:function|method)\s+(?:called\s+|named\s+)?(\w+)/i;
const CLASS_PATTERN = /(?:explain|describe|what is)\s+(?:the\s+)?(?:class)\s+(?:called\s+|named\s+)?(\w+)/i;

export class QueryClassifierService {
  classify(question: string): ClassificationResult {
    const lower = question.toLowerCase().trim();
    const keywords = this.extractKeywords(question);

    // Check for file-specific questions
    const fileMatch = question.match(FILE_PATTERN);
    if (fileMatch) {
      return {
        type: 'file_explain',
        keywords,
        targetFile: fileMatch[1]!,
      };
    }

    // Check for function-specific questions
    const funcMatch = question.match(FUNCTION_PATTERN);
    if (funcMatch) {
      return {
        type: 'function_explain',
        keywords,
        targetFunction: funcMatch[1]!,
      };
    }

    const classMatch = question.match(CLASS_PATTERN);
    if (classMatch) {
      return {
        type: 'function_explain',
        keywords,
        targetFunction: classMatch[1]!,
      };
    }

    // Project overview questions
    if (
      lower.includes('explain the project') ||
      lower.includes('what does this project') ||
      lower.includes('what is this project') ||
      lower.includes('overview') ||
      lower.includes('project overview') ||
      lower.includes('describe the project') ||
      (lower.includes('what') && lower.includes('project') && lower.includes('do'))
    ) {
      return { type: 'project_overview', keywords };
    }

    // Architecture questions
    if (
      lower.includes('architecture') ||
      lower.includes('api flow') ||
      lower.includes('request flow') ||
      lower.includes('project structure') ||
      (lower.includes('how') && lower.includes('organiz')) ||
      lower.includes('folder structure') ||
      lower.includes('directory structure')
    ) {
      return { type: 'architecture', keywords };
    }

    // Tech stack questions
    if (
      lower.includes('authentication') ||
      lower.includes('auth') ||
      lower.includes('how does auth') ||
      lower.includes('explain auth') ||
      lower.includes('database') ||
      lower.includes('which database') ||
      lower.includes('what database') ||
      lower.includes('technologies') ||
      lower.includes('tech stack') ||
      lower.includes('framework') ||
      lower.includes('what libraries') ||
      lower.includes('what tools')
    ) {
      return { type: 'tech_stack', keywords };
    }

    // Code location questions (where is X generated/defined/connected)
    if (
      lower.includes('where is') ||
      lower.includes('where does') ||
      lower.includes('where are') ||
      lower.includes('find where') ||
      lower.includes('locate') ||
      lower.includes('generated') ||
      lower.includes('defined') ||
      lower.includes('connected') ||
      lower.includes('initialized')
    ) {
      return { type: 'code_location', keywords };
    }

    // Middleware questions
    if (
      lower.includes('middleware') ||
      (lower.includes('middle') && lower.includes('ware'))
    ) {
      return { type: 'middleware', keywords };
    }

    // Default to general
    return { type: 'general', keywords };
  }

  private extractKeywords(question: string): string[] {
    // Remove common question words and extract meaningful keywords
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
      'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
      'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
      'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
      'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
      'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
      'just', 'because', 'about', 'up', 'it', 'its', 'this', 'that', 'these',
      'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she',
      'they', 'them', 'what', 'which', 'who', 'whom', 'explain', 'describe',
      'tell', 'show', 'find', 'get', 'give', 'provide', 'list', 'tell me about',
    ]);

    return question
      .toLowerCase()
      .replace(/[?.,!;:]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));
  }
}

export const queryClassifierService = new QueryClassifierService();
