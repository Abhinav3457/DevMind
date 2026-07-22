interface ParseResult {
  functions: { name: string; startLine: number; endLine: number }[];
  classes: { name: string; startLine: number; endLine: number }[];
  imports: string[];
  exports: string[];
}

export class CodeParserService {
  parse(content: string, language: string): ParseResult {
    const lines = content.split('\n');

    const functions: ParseResult['functions'] = [];
    const classes: ParseResult['classes'] = [];
    const imports: string[] = [];
    const exports: string[] = [];

    if (['typescript', 'tsx', 'javascript', 'jsx'].includes(language)) {
      this.parseTypeScriptLike(lines, functions, classes, imports, exports);
    } else if (language === 'python') {
      this.parsePythonLike(lines, functions, classes, imports, exports);
    } else if (['java', 'csharp', 'go', 'rust'].includes(language)) {
      this.parseCStyle(lines, functions, classes, imports, exports, language);
    }

    return { functions, classes, imports, exports };
  }

  private parseTypeScriptLike(
    lines: string[],
    functions: ParseResult['functions'],
    classes: ParseResult['classes'],
    imports: string[],
    exports: string[],
  ): void {
    let braceDepth = 0;
    let currentFunction: { name: string; startLine: number; endLine: number } | null = null;
    let currentClass: { name: string; startLine: number; endLine: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const trimmed = line.trim();

      const importMatch = trimmed.match(/^import\s+(.+?)\s+from\s+['"](.+?)['"]/);
      if (importMatch) {
        imports.push(importMatch[2]!);
      }

      const requireMatch = trimmed.match(/^const\s+.+?\s*=\s*require\s*\(['"](.+?)['"]\)/);
      if (requireMatch) {
        imports.push(requireMatch[1]!);
      }

      const exportMatch = trimmed.match(/^export\s+(.+)/);
      if (exportMatch) {
        exports.push(exportMatch[1]!);
      }

      const funcMatch = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (funcMatch) {
        currentFunction = { name: funcMatch[1]!, startLine: i + 1, endLine: i + 1 };
        continue;
      }

      const arrowFuncMatch = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[:=]\s*(?:async\s*)?\(/);
      if (arrowFuncMatch && !currentFunction) {
        currentFunction = { name: arrowFuncMatch[1]!, startLine: i + 1, endLine: i + 1 };
      }

      const classMatch = trimmed.match(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
      if (classMatch) {
        currentClass = { name: classMatch[1]!, startLine: i + 1, endLine: i + 1 };
        continue;
      }

      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }

      if (currentFunction && braceDepth === 0) {
        currentFunction.endLine = i + 1;
        functions.push(currentFunction);
        currentFunction = null;
      }

      if (currentClass && braceDepth === 0) {
        currentClass.endLine = i + 1;
        classes.push(currentClass);
        currentClass = null;
      }
    }
  }

  private parsePythonLike(
    lines: string[],
    functions: ParseResult['functions'],
    classes: ParseResult['classes'],
    imports: string[],
    _exports: string[],
  ): void {
    let currentFunction: { name: string; startLine: number; endLine: number } | null = null;
    let currentClass: { name: string; startLine: number; endLine: number } | null = null;
    let classIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();
      if (!trimmed) continue;

      const indent = lines[i]!.search(/\S/);

      const importMatch = trimmed.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)/);
      if (importMatch) {
        imports.push(importMatch[1] || importMatch[2]!);
      }

      const classMatch = trimmed.match(/^class\s+(\w+)/);
      if (classMatch) {
        if (currentClass) classes.push(currentClass);
        currentClass = { name: classMatch[1]!, startLine: i + 1, endLine: i + 1 };
        classIndent = indent;
        continue;
      }

      const funcMatch = trimmed.match(/^def\s+(\w+)/);
      if (funcMatch) {
        if (currentFunction) functions.push(currentFunction);
        currentFunction = { name: funcMatch[1]!, startLine: i + 1, endLine: i + 1 };
        continue;
      }

      if (currentFunction && indent <= (currentFunction.startLine === i ? 0 : 0)) {
        currentFunction.endLine = i;
        functions.push(currentFunction);
        currentFunction = null;
      }

      if (currentClass && indent <= classIndent && i > currentClass.startLine) {
        currentClass.endLine = i;
        classes.push(currentClass);
        currentClass = null;
      }
    }

    if (currentFunction) { currentFunction.endLine = lines.length; functions.push(currentFunction); }
    if (currentClass) { currentClass.endLine = lines.length; classes.push(currentClass); }
  }

  private parseCStyle(
    lines: string[],
    functions: ParseResult['functions'],
    classes: ParseResult['classes'],
    imports: string[],
    _exports: string[],
    _language: string,
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();

      const importMatch = trimmed.match(/^(?:import|use|require)\s+(.+)/);
      if (importMatch) {
        imports.push(importMatch[1]!);
      }

      const funcMatch = trimmed.match(/(?:pub\s+)?(?:fn|func|def|public|private|protected)\s+(\w+)\s*\(/);
      if (funcMatch) {
        functions.push({ name: funcMatch[1]!, startLine: i + 1, endLine: i + 1 });
      }

      const classMatch = trimmed.match(/(?:pub\s+)?(?:class|struct|interface|trait)\s+(\w+)/);
      if (classMatch) {
        classes.push({ name: classMatch[1]!, startLine: i + 1, endLine: i + 1 });
      }
    }
  }

  extractDependencies(imports: string[]): string[] {
    const deps: string[] = [];
    for (const imp of imports) {
      if (imp.startsWith('.') || imp.startsWith('/')) continue;
      const parts = imp.split('/');
      const scope = parts[0]!.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
      if (scope && !deps.includes(scope)) {
        deps.push(scope);
      }
    }
    return deps.sort();
  }
}

export const codeParserService = new CodeParserService();
