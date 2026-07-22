import { IFolderNode, ITechStack } from '../models/IndexReport';
import { IIndexedFile } from '../models/IndexedFile';

interface AnalyzerInput {
  files: { file: IIndexedFile; content: string }[];
  rootPath: string;
}

interface AnalyzerOutput {
  summary: string;
  techStack: ITechStack;
  folderStructure: IFolderNode[];
  fileCount: number;
}

const AUTH_PATTERNS = [
  { name: 'JWT', patterns: ['jsonwebtoken', 'jwt', 'JWT', 'JsonWebTokenError'] },
  { name: 'Passport.js', patterns: ['passport', 'passport-jwt', 'passport-local'] },
  { name: 'NextAuth.js', patterns: ['next-auth', 'NextAuth'] },
  { name: 'Auth0', patterns: ['auth0', 'Auth0'] },
  { name: 'Clerk', patterns: ['@clerk', 'clerk-sdk'] },
  { name: 'Firebase Auth', patterns: ['firebase/auth', 'firebase-admin/auth'] },
  { name: 'Supabase Auth', patterns: ['@supabase/supabase-js', 'supabase.auth'] },
  { name: 'Session/Cookie', patterns: ['express-session', 'cookie-parser'] },
  { name: 'OAuth', patterns: ['oauth', 'OAuth', 'OAuth2'] },
  { name: 'bcrypt', patterns: ['bcrypt', 'bcryptjs', 'argon2'] },
];

const DB_PATTERNS = [
  { name: 'MongoDB', patterns: ['mongodb', 'mongoose'] },
  { name: 'PostgreSQL', patterns: ['pg', 'postgres', 'postgresql', 'pg-promise', 'slonik'] },
  { name: 'MySQL', patterns: ['mysql', 'mysql2', 'mariadb'] },
  { name: 'SQLite', patterns: ['sqlite', 'sqlite3', 'better-sqlite3'] },
  { name: 'Prisma', patterns: ['@prisma/client', 'prisma'] },
  { name: 'TypeORM', patterns: ['typeorm'] },
  { name: 'Drizzle', patterns: ['drizzle-orm', 'drizzle-kit'] },
  { name: 'Redis', patterns: ['redis', 'ioredis'] },
  { name: 'Firebase', patterns: ['firebase', 'firebase-admin'] },
  { name: 'Supabase', patterns: ['@supabase/supabase-js'] },
  { name: 'Elasticsearch', patterns: ['@elastic/elasticsearch', 'elasticsearch'] },
];

const FRAMEWORK_PATTERNS = [
  { name: 'React', patterns: ['react', 'react-dom'] },
  { name: 'Next.js', patterns: ['next', 'next/link'] },
  { name: 'Express.js', patterns: ['express'] },
  { name: 'NestJS', patterns: ['@nestjs/core', '@nestjs/common'] },
  { name: 'Vue.js', patterns: ['vue', 'vue-router', 'vuex', 'pinia'] },
  { name: 'Angular', patterns: ['@angular/core'] },
  { name: 'Svelte', patterns: ['svelte', '@sveltejs/kit'] },
  { name: 'Django', patterns: ['django'] },
  { name: 'Flask', patterns: ['flask'] },
  { name: 'FastAPI', patterns: ['fastapi'] },
  { name: 'Rails', patterns: ['rails', 'activerecord'] },
  { name: 'Spring Boot', patterns: ['spring-boot'] },
  { name: 'ASP.NET', patterns: ['microsoft.aspnetcore'] },
  { name: 'Fastify', patterns: ['fastify'] },
  { name: 'Hono', patterns: ['hono'] },
  { name: 'Solid.js', patterns: ['solid-js'] },
  { name: 'Nuxt.js', patterns: ['nuxt', '@nuxtjs'] },
  { name: 'Gatsby', patterns: ['gatsby'] },
  { name: 'Remix', patterns: ['@remix-run'] },
  { name: 'Vite', patterns: ['vite'] },
  { name: 'Webpack', patterns: ['webpack'] },
];

const LIBRARY_PATTERNS = [
  { name: 'Axios', patterns: ['axios'] },
  { name: 'TanStack Query', patterns: ['@tanstack/react-query', 'react-query'] },
  { name: 'Zustand', patterns: ['zustand'] },
  { name: 'Redux', patterns: ['redux', 'react-redux', '@reduxjs/toolkit'] },
  { name: 'Socket.io', patterns: ['socket.io', 'socket.io-client'] },
  { name: 'Tailwind CSS', patterns: ['tailwindcss', 'tailwind.config'] },
  { name: 'Bootstrap', patterns: ['bootstrap'] },
  { name: 'Material UI', patterns: ['@mui/material'] },
  { name: 'Ant Design', patterns: ['antd', '@ant-design'] },
  { name: 'Chart.js', patterns: ['chart.js'] },
  { name: 'D3.js', patterns: ['d3', 'd3-scale'] },
  { name: 'Lodash', patterns: ['lodash'] },
  { name: 'date-fns', patterns: ['date-fns'] },
  { name: 'Zod', patterns: ['zod'] },
  { name: 'Joi', patterns: ['joi'] },
  { name: 'Yup', patterns: ['yup'] },
  { name: 'React Router', patterns: ['react-router-dom'] },
  { name: 'Framer Motion', patterns: ['framer-motion'] },
  { name: 'LangChain', patterns: ['langchain', '@langchain'] },
  { name: 'ChromaDB', patterns: ['chromadb'] },
  { name: 'OpenAI', patterns: ['openai', '@openai'] },
  { name: 'GraphQL', patterns: ['graphql', 'apollo-server', '@apollo/client'] },
  { name: 'Playwright', patterns: ['playwright'] },
  { name: 'Cypress', patterns: ['cypress'] },
  { name: 'Jest', patterns: ['jest', 'ts-jest'] },
  { name: 'Vitest', patterns: ['vitest'] },
  { name: 'ESLint', patterns: ['eslint'] },
  { name: 'Prettier', patterns: ['prettier'] },
];

export class AnalyzerService {
  analyze(input: AnalyzerInput): AnalyzerOutput {
    const { files, rootPath } = input;
    const allImports = new Set<string>();

    for (const { file } of files) {
      for (const imp of file.imports) allImports.add(imp);
    }

    const contentText = files.map(f => f.content).join('\n').toLowerCase();

    const techStack = {
      authentication: this.detectItems(AUTH_PATTERNS, allImports, contentText),
      databases: this.detectItems(DB_PATTERNS, allImports, contentText),
      frameworks: this.detectItems(FRAMEWORK_PATTERNS, allImports, contentText),
      libraries: this.detectItems(LIBRARY_PATTERNS, allImports, contentText),
      envVars: this.detectEnvVars(contentText, files.map(f => f.content)),
    };

    const folderStructure = this.buildFolderStructure(files.map(f => f.file.path), rootPath);
    const summary = this.generateSummary(files, techStack);

    return { summary, techStack, folderStructure, fileCount: files.length };
  }

  private detectItems(
    patterns: { name: string; patterns: string[] }[],
    allImports: Set<string>,
    contentText: string,
  ): string[] {
    const detected = new Set<string>();
    for (const item of patterns) {
      const found = item.patterns.some(p => {
        const lower = p.toLowerCase();
        return [...allImports].some(imp => imp.toLowerCase().includes(lower)) || contentText.includes(lower);
      });
      if (found) detected.add(item.name);
    }
    return [...detected].sort();
  }

  private detectEnvVars(fullContent: string, fileContents: string[]): string[] {
    const envVars = new Set<string>();
    const envPattern = /(?:process\.env\.(\w+)|process\.env\['(\w+)'\]|process\.env\["(\w+)"\])/g;
    let match: RegExpExecArray | null;
    while ((match = envPattern.exec(fullContent)) !== null) {
      const varName = match[1] || match[2] || match[3];
      if (varName) envVars.add(varName);
    }
    for (const content of fileContents) {
      const envLinePattern = /^([A-Z_][A-Z0-9_]*)=/gm;
      let envMatch: RegExpExecArray | null;
      while ((envMatch = envLinePattern.exec(content)) !== null) {
        envVars.add(envMatch[1]!);
      }
    }
    return [...envVars].sort();
  }

  private buildFolderStructure(filePaths: string[], rootPath: string): IFolderNode[] {
    const root: IFolderNode = {
      path: rootPath,
      name: this.getFolderName(rootPath),
      type: 'folder',
      children: [],
    };

    for (const filePath of filePaths) {
      const relative = filePath.replace(rootPath, '').replace(/^[/\\]/, '');
      const parts = relative.split(/[/\\]/);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!;
        if (!part) continue;

        if (i === parts.length - 1) {
          if (!current.children) current.children = [];
          const existing = current.children.find(c => c.name === part && c.type === 'file');
          if (!existing) {
            current.children.push({ path: filePath, name: part, type: 'file' });
          }
        } else {
          if (!current.children) current.children = [];
          let folder = current.children.find(c => c.name === part && c.type === 'folder');
          if (!folder) {
            folder = { path: filePath.substring(0, filePath.indexOf(part) + part.length), name: part, type: 'folder', children: [] };
            current.children.push(folder);
          }
          current = folder;
        }
      }
    }

    const sortChildren = (node: IFolderNode): void => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        for (const child of node.children) {
          if (child.children) sortChildren(child);
        }
      }
    };

    if (root.children) sortChildren(root);
    return root.children || [];
  }

  private generateSummary(files: { file: IIndexedFile; content: string }[], techStack: ITechStack): string {
    const totalFiles = files.length;
    const languages = new Map<string, number>();
    let totalLines = 0;

    for (const { file, content } of files) {
      languages.set(file.language, (languages.get(file.language) || 0) + 1);
      totalLines += content.split('\n').length;
    }

    const langSummary = [...languages.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang, count]) => lang + ': ' + count + ' files')
      .join(', ');

    const techSummary = [
      techStack.frameworks.length > 0 ? 'Framework(s): ' + techStack.frameworks.join(', ') : '',
      techStack.databases.length > 0 ? 'Database(s): ' + techStack.databases.join(', ') : '',
      techStack.authentication.length > 0 ? 'Auth: ' + techStack.authentication.join(', ') : '',
    ].filter(Boolean).join(' | ');

    return 'This project contains ' + totalFiles + ' source files (' + langSummary + '). ' +
      'Approximately ' + totalLines + ' lines of code. ' +
      (techSummary ? 'Key technologies: ' + techSummary + '.' : '');
  }

  private getFolderName(rootPath: string): string {
    const parts = rootPath.replace(/[/\\]$/, '').split(/[/\\]/);
    return parts[parts.length - 1] || 'root';
  }
}

export const analyzerService = new AnalyzerService();
