#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ── Colors (ANSI escape codes, no dependencies) ──────────────────────
const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  cyan:    '\x1b[36m',
  yellow:  '\x1b[33m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m',
};

// ── Parse arguments ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('-'));
const positional = args.filter(a => !a.startsWith('-'));

if (flags.includes('--help') || flags.includes('-h')) {
  console.log(`
${c.bold}create-rebar${c.reset} — Scaffold Rebar into any Claude Code project

${c.bold}Usage:${c.reset}
  npx create-rebar my-project   Create a new directory with Rebar
  npx create-rebar              Scaffold into the current directory
  npx create-rebar --init       Same as above

${c.bold}Options:${c.reset}
  --init       Initialize in current directory
  --help, -h   Show this help message
  --version    Show version
`);
  process.exit(0);
}

if (flags.includes('--version')) {
  const pkg = require('./package.json');
  console.log(pkg.version);
  process.exit(0);
}

// ── Determine target directory ───────────────────────────────────────
let targetDir;
if (positional.length > 0) {
  targetDir = path.resolve(process.cwd(), positional[0]);
} else {
  targetDir = process.cwd();
}

const projectName = path.basename(targetDir);
const templatesDir = path.join(__dirname, 'templates');

// ── Helpers ──────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  ensureDir(destDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function fileCount(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).length;
}

// ── Check for existing files ─────────────────────────────────────────
const claudeMdPath = path.join(targetDir, 'CLAUDE.md');
if (fs.existsSync(claudeMdPath)) {
  console.log(`\n${c.yellow}Warning:${c.reset} CLAUDE.md already exists in ${targetDir}`);
  console.log(`${c.dim}Rebar may already be initialized. Use --force to overwrite.${c.reset}\n`);
  if (!flags.includes('--force')) {
    process.exit(1);
  }
}

// ── Scaffold ─────────────────────────────────────────────────────────
console.log(`\n${c.bold}${c.magenta}Rebar${c.reset} ${c.dim}Scaffolding structural memory...${c.reset}\n`);

// 1. Create target directory
ensureDir(targetDir);

// 2. Copy .claude/commands/ (all 23 slash commands)
const commandsSrc = path.join(templatesDir, 'commands');
const commandsDest = path.join(targetDir, '.claude', 'commands');
copyDir(commandsSrc, commandsDest);
const cmdCount = fileCount(commandsDest);

// 3. Copy CLAUDE.md
copyFile(path.join(templatesDir, 'claude-md.txt'), claudeMdPath);

// 4. Create apps/_templates/
const appsTemplatesDir = path.join(targetDir, 'apps', '_templates');
ensureDir(appsTemplatesDir);
copyFile(
  path.join(templatesDir, 'app-template.yaml'),
  path.join(appsTemplatesDir, 'app.yaml')
);

// 5. Create clients/_templates/
const clientsTemplatesDir = path.join(targetDir, 'clients', '_templates');
ensureDir(clientsTemplatesDir);
ensureDir(path.join(clientsTemplatesDir, 'research'));
ensureDir(path.join(clientsTemplatesDir, 'specs'));
copyFile(
  path.join(templatesDir, 'client-template.yaml'),
  path.join(clientsTemplatesDir, 'client.yaml')
);
copyFile(
  path.join(templatesDir, 'expertise-template.yaml'),
  path.join(clientsTemplatesDir, 'expertise.yaml')
);
copyFile(
  path.join(templatesDir, 'notes-template.md'),
  path.join(clientsTemplatesDir, 'notes.md')
);
copyFile(
  path.join(templatesDir, 'phase-0-template.md'),
  path.join(clientsTemplatesDir, 'phase-0-discovery.md')
);

// 6. Create tools/_templates/
const toolsTemplatesDir = path.join(targetDir, 'tools', '_templates');
ensureDir(toolsTemplatesDir);
copyFile(
  path.join(templatesDir, 'tool-template.yaml'),
  path.join(toolsTemplatesDir, 'tool.yaml')
);
copyFile(
  path.join(templatesDir, 'tool-expertise-template.yaml'),
  path.join(toolsTemplatesDir, 'expertise.yaml')
);

// 7. Create wiki/
const wikiDir = path.join(targetDir, 'wiki');
ensureDir(wikiDir);
copyFile(
  path.join(templatesDir, 'wiki-readme.md'),
  path.join(wikiDir, 'README.md')
);

// 8. Create raw/ and raw/processed/
ensureDir(path.join(targetDir, 'raw', 'processed'));

// 9. Create system/ and system/drafts/
ensureDir(path.join(targetDir, 'system', 'drafts'));

// 10. Create .gitignore additions
const gitignorePath = path.join(targetDir, '.gitignore');
const gitignoreEntries = [
  '# Rebar - sensitive config files',
  'clients/*/client.yaml',
  'apps/*/app.yaml',
  'clients/*/research/',
  'apps/*/research/',
  'tools/*/research/',
  '',
].join('\n');

if (fs.existsSync(gitignorePath)) {
  const existing = fs.readFileSync(gitignorePath, 'utf8');
  if (!existing.includes('clients/*/client.yaml')) {
    fs.appendFileSync(gitignorePath, '\n' + gitignoreEntries + '\n');
  }
} else {
  fs.writeFileSync(gitignorePath, gitignoreEntries + '\n');
}

// ── Success output ───────────────────────────────────────────────────
const isCurrentDir = targetDir === process.cwd();
const displayPath = isCurrentDir ? '.' : positional[0];

console.log(`  ${c.green}\u2713${c.reset} ${c.bold}.claude/commands/${c.reset}     ${c.dim}${cmdCount} slash commands${c.reset}`);
console.log(`  ${c.green}\u2713${c.reset} ${c.bold}CLAUDE.md${c.reset}             ${c.dim}Project configuration${c.reset}`);
console.log(`  ${c.green}\u2713${c.reset} ${c.bold}apps/_templates/${c.reset}      ${c.dim}App scaffolding templates${c.reset}`);
console.log(`  ${c.green}\u2713${c.reset} ${c.bold}clients/_templates/${c.reset}   ${c.dim}Client engagement templates${c.reset}`);
console.log(`  ${c.green}\u2713${c.reset} ${c.bold}tools/_templates/${c.reset}     ${c.dim}Tool integration templates${c.reset}`);
console.log(`  ${c.green}\u2713${c.reset} ${c.bold}wiki/${c.reset}                 ${c.dim}Knowledge wiki${c.reset}`);
console.log(`  ${c.green}\u2713${c.reset} ${c.bold}raw/${c.reset}                  ${c.dim}File intake folder${c.reset}`);
console.log(`  ${c.green}\u2713${c.reset} ${c.bold}system/${c.reset}               ${c.dim}System drafts${c.reset}`);
console.log(`  ${c.green}\u2713${c.reset} ${c.bold}.gitignore${c.reset}            ${c.dim}Sensitive files excluded${c.reset}`);

console.log(`\n${c.bold}${c.green}Rebar initialized!${c.reset}\n`);

console.log(`${c.bold}Next steps:${c.reset}`);
if (!isCurrentDir) {
  console.log(`  ${c.cyan}cd ${positional[0]}${c.reset}`);
}
console.log(`  ${c.cyan}claude${c.reset}                ${c.dim}# Open Claude Code${c.reset}`);
console.log(`  ${c.cyan}/create my-client${c.reset}     ${c.dim}# Create your first project${c.reset}`);
console.log(`  ${c.cyan}/discover my-client${c.reset}   ${c.dim}# Auto-generate expertise${c.reset}`);

console.log(`\n${c.dim}Docs: https://getrebar.dev${c.reset}\n`);
