import { chromium } from 'playwright';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createGenerator } from '@lorem-gibson/generator';
import { sanitizePage } from '@lorem-gibson/playwright-sanitizer';

// Lazily launched, kept alive across tool calls for this server process,
// closed on shutdown. One browser, fresh page per call.
let browserPromise;
function getBrowser() {
  if (!browserPromise) browserPromise = chromium.launch();
  return browserPromise;
}

const SANITIZE_SHAPE = {
  seed: z.union([z.string(), z.number()]).optional().describe('Deterministic output — same seed, same placeholder text/images every run.'),
  includeProperNouns: z.boolean().optional().describe('Mix in Neuromancer proper-noun/glossary terms alongside general vocabulary (default true).'),
  exclude: z.array(z.string()).optional().describe('CSS selectors to leave untouched.'),
  include: z.string().optional().describe('CSS selector — if set, ONLY sanitize inside matching elements.'),
  images: z.boolean().optional().describe('Also replace <img> content with CRT dead-channel static/scanlines/scrambled/phosphor (default false).'),
};

function buildSanitizeOptions(args) {
  const opts = {};
  if (args.seed !== undefined) opts.seed = args.seed;
  if (args.includeProperNouns !== undefined) opts.includeProperNouns = args.includeProperNouns;
  if (args.exclude !== undefined) opts.exclude = args.exclude;
  if (args.include !== undefined) opts.include = args.include;
  if (args.images !== undefined) opts.images = args.images;
  return opts;
}

export function createServer() {
  const server = new McpServer({ name: 'lorem-gibson', version: '1.0.0' });

  server.tool(
    'generate_text',
    'Generate William Gibson-style ("Lorem Gibson") cyberpunk placeholder text — words, sentences, paragraphs, Title Case headings, or kebab-case slugs.',
    {
      kind: z.enum(['word', 'sentence', 'paragraph', 'title', 'slug']).describe('What shape of text to generate.'),
      count: z.number().int().positive().optional().describe('How many to generate (default 1).'),
      seed: z.union([z.string(), z.number()]).optional().describe('Deterministic output — same seed, same result every call.'),
    },
    async ({ kind, count = 1, seed }) => {
      const gen = createGenerator({ seed });
      const producers = {
        word: () => Array.from({ length: count }, gen.word),
        sentence: () => gen.sentences(count),
        paragraph: () => gen.paragraphs(count),
        title: () => Array.from({ length: count }, () => gen.title()),
        slug: () => Array.from({ length: count }, () => gen.slug()),
      };
      const results = producers[kind]();
      const text = kind === 'paragraph' ? results.join('\n\n') : results.join('\n');
      return { content: [{ type: 'text', text }] };
    },
  );

  server.tool(
    'screenshot_sanitized',
    'Navigate to a URL, replace real page text/attributes/input values (and optionally images, as CRT dead-channel static) with Lorem Gibson placeholder content, then take a screenshot. For anonymizing UI screenshots headed into docs/tickets/blog posts.',
    {
      url: z.string().describe('URL to navigate to.'),
      fullPage: z.boolean().optional().describe('Capture the full scrollable page rather than just the viewport (default true).'),
      waitFor: z.string().optional().describe('CSS selector to wait for before sanitizing (useful for content that loads async).'),
      ...SANITIZE_SHAPE,
    },
    async ({ url, fullPage = true, waitFor, ...sanitizeArgs }) => {
      const browser = await getBrowser();
      const page = await browser.newPage();
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        if (waitFor) await page.waitForSelector(waitFor);
        await sanitizePage(page, buildSanitizeOptions(sanitizeArgs));
        const buffer = await page.screenshot({ fullPage });
        return {
          content: [
            { type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' },
            { type: 'text', text: `Sanitized screenshot of ${url} (${fullPage ? 'full page' : 'viewport'}).` },
          ],
        };
      } finally {
        await page.close();
      }
    },
  );

  server.tool(
    'sanitize_html',
    'Load raw HTML into a headless page, replace real text/attributes/input values with Lorem Gibson placeholder content, and return the sanitized HTML — no screenshot, no URL needed.',
    {
      html: z.string().describe('Raw HTML document/fragment to sanitize.'),
      ...SANITIZE_SHAPE,
    },
    async ({ html, ...sanitizeArgs }) => {
      const browser = await getBrowser();
      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'load' });
        await sanitizePage(page, buildSanitizeOptions(sanitizeArgs));
        const sanitizedHtml = await page.content();
        return { content: [{ type: 'text', text: sanitizedHtml }] };
      } finally {
        await page.close();
      }
    },
  );

  return server;
}

export async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  async function shutdown() {
    if (browserPromise) {
      const browser = await browserPromise;
      await browser.close().catch(() => {});
    }
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
