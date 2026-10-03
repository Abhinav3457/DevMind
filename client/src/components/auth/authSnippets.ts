export type CodeSnippets = { blockA: string[]; blockB: string[] };

export const LOGIN_SNIPPETS: CodeSnippets = {
  blockA: [
    `const repo = await devmind.import('my-app');
const review = await devmind.review(repo);

// quality score
console.log(review.score); // 91

const issues = review.issues.filter((i) => i.severity === 'high');
for (const issue of issues) {
  console.log(issue.file + ':' + issue.line + ' - ' + issue.message);
}

const plan = await devmind.plan(repo, {
  goal: 'fix failing tests',
  branch: 'main'
});

await devmind.apply(plan);
console.log('applied ' + plan.steps.length + ' steps');`,
    `const answer = await devmind.chat({
  repo: 'my-app',
  question: 'Where is auth handled?'
});

console.log(answer.text);
console.log('confidence: ' + answer.confidence);

for (const source of answer.sources) {
  console.log('-> ' + source.path + ':' + source.line);
}

const follow = await devmind.chat({
  repo: 'my-app',
  question: 'Add tests for it',
  context: answer
});

console.log(follow.text);`,
  ],
  blockB: [
    `$ devmind docs generate --repo my-app
Reading 42 files...
Indexing symbols...
Scanning routes and controllers...
Generating documentation...
Rendering API reference...
Writing markdown pages...
Done: 24 pages created

$ devmind docs preview --port 4000
Starting local server...
Watching for changes...
Ready on http://localhost:4000`,
    `function solve(nums, target) {
  const seen = new Map();

  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];

    if (seen.has(need)) {
      return [seen.get(need), i];
    }

    seen.set(nums[i], i);
  }

  // two sum
  return seen;
}

console.log(solve([2, 7, 11, 15], 9));`,
  ],
};

export const REGISTER_SNIPPETS: CodeSnippets = {
  blockA: [
    `const user = await devmind.signup({
  name: 'Ada Lovelace',
  email: 'ada@devmind.ai'
});

// send verification code
await devmind.verify.send(user.email);

console.log('account:', user.id);
console.log('workspace:', user.workspace);`,
    `const plan = await devmind.onboard({
  user: user.id,
  templates: ['node-api', 'react-app']
});

for (const step of plan.steps) {
  console.log('-> ' + step.name + ' [' + step.status + ']');
}

console.log('setup complete in ' + plan.seconds + 's');`,
  ],
  blockB: [
    `$ devmind auth register --email ada@devmind.ai
Creating account...
Provisioning workspace...
Sending verification code...
Done: check your inbox

$ devmind workspace create my-first-app
Scaffolding project...
Installing dependencies...
Ready: my-first-app`,
    `function validateEmail(value) {
  const valid = /@/.test(value) && value.length > 4;

  // basic sanity check
  if (!valid) {
    return false;
  }

  return true;
}

console.log(validateEmail('ada@devmind.ai'));`,
  ],
};
