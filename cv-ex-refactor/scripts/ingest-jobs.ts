// CLI dispatcher for the job ingest pipeline.
// Usage: pnpm run ingest <command> [args]
// Env: loaded from .env.local via tsx --env-file flag in package.json script.

const COMMANDS = ['paste', 'file', 'urls', 'itviec', 'stats', 'expire', 'rebuild-embeddings', 'build-vertical-index'] as const;
type Command = (typeof COMMANDS)[number];

function printHelp(): void {
  console.log(`
Usage: pnpm run ingest <command> [args]

Commands:
  paste                    Interactive: prompt for one job's fields, classify, embed, save
  file <path>              Batch: read JSON array from file, dedup, classify, embed, save
  urls <url> [<url>...]    Batch: fetch each URL, extract JSON-LD JobPosting, dedup, embed, save
  itviec <slug> [<slug>...] [--pages N]
                           Discover URLs from ITviec category listing pages (JSON-LD ItemList),
                           then ingest. Default 1 page (~20 URLs/slug). Example slugs:
                           data-engineer, senior-data-engineer, backend-developer, devops
  stats                    Print active/expired counts by vertical and seniority
  expire                   Mark jobs where verifiedAt > 21 days as expired
  rebuild-embeddings       Pack all active embeddings into a versioned KV blob
  build-vertical-index     Rebuild jobs:by-vertical KV index from active jobs (run post-ingest)

Environment required (in .env.local):
  GEMINI_API_KEY           Operator's Gemini API key (NOT the shared app key)
  KV_REST_API_URL          Upstash KV REST URL
  KV_REST_API_TOKEN        Upstash KV REST token
`);
}

function assertEnv(): void {
  const missing: string[] = [];
  if (!process.env['GEMINI_API_KEY']) missing.push('GEMINI_API_KEY');
  if (!process.env['KV_REST_API_URL']) missing.push('KV_REST_API_URL');
  if (!process.env['KV_REST_API_TOKEN']) missing.push('KV_REST_API_TOKEN');

  if (missing.length > 0) {
    console.error(
      `[ingest] Missing required env vars: ${missing.join(', ')}\n` +
        'Copy .env.example to .env.local and fill in the values.',
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const [, , cmd, ...args] = process.argv;

  if (!cmd || cmd === '--help' || cmd === '-h') {
    printHelp();
    process.exit(0);
  }

  if (!(COMMANDS as readonly string[]).includes(cmd)) {
    console.error(`[ingest] Unknown command: "${cmd}"`);
    printHelp();
    process.exit(1);
  }

  assertEnv();

  switch (cmd as Command) {
    case 'paste': {
      const { run } = await import('./ingest-paste.js');
      await run(args);
      break;
    }
    case 'file': {
      const { run } = await import('./ingest-file.js');
      await run(args);
      break;
    }
    case 'urls': {
      const { run } = await import('./ingest-urls.js');
      await run(args);
      break;
    }
    case 'itviec': {
      const { run } = await import('./ingest-itviec.js');
      await run(args);
      break;
    }
    case 'stats': {
      const { run } = await import('./ingest-stats.js');
      await run();
      break;
    }
    case 'expire': {
      const { run } = await import('./ingest-expire.js');
      await run();
      break;
    }
    case 'rebuild-embeddings': {
      const { run } = await import('./ingest-rebuild-embeddings.js');
      await run();
      break;
    }
    case 'build-vertical-index': {
      const { run } = await import('./build-vertical-index.js');
      await run();
      break;
    }
  }
}

main().catch((err) => {
  console.error('[ingest] Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
