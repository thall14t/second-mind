/**
 * Stress test: ~50 varied Quick Capture payloads through the full routing pipeline.
 * classify-capture -> enrich-card-capture OR generate-todos
 *
 * Usage: node scripts/run-capture-routing-stress-test.js [baseUrl]
 * Default baseUrl: http://127.0.0.1:3001
 */

const BASE_URL = (process.argv[2] || 'http://127.0.0.1:3001').replace(/\/+$/, '');

const CAPTURE_FIXTURES = [
  { id: '01', label: 'Scripture quote', expected: 'card', title: 'Grace', content: '"For by grace you have been saved through faith." — Ephesians 2:8' },
  { id: '02', label: 'Book quote with page', expected: 'card', title: '', content: 'The life of the mind is the best life. — Aristotle, Nicomachean Ethics, p. 42' },
  { id: '03', label: 'URL source note', expected: 'card', title: 'LLM context windows', content: 'Interesting point about retrieval over long contexts https://example.com/research/context' },
  { id: '04', label: 'Aphorism', expected: 'card', title: '', content: 'The unexamined life is not worth living.' },
  { id: '05', label: 'Book idea seed', expected: 'card', title: 'Book idea', content: 'A novel where memory is traded like currency in a post-scarcity city.' },
  { id: '06', label: 'Article idea', expected: 'card', title: 'Article idea', content: 'Why small teams outperform large ones on taste decisions.' },
  { id: '07', label: 'Concept note', expected: 'card', title: 'Antifragility', content: 'Some systems gain from disorder; exposure to stressors can make them stronger rather than weaker.' },
  { id: '08', label: 'Paraphrase with author', expected: 'card', title: '', content: 'According to Calvin, the heart is an idol factory.' },
  { id: '09', label: 'Poetry fragment', expected: 'card', title: 'Hope', content: '"Hope is the thing with feathers / That perches in the soul."' },
  { id: '10', label: 'Research snippet', expected: 'card', title: 'Spaced repetition', content: 'Spacing study sessions improves long-term retention more than massed practice for most learners.' },
  { id: '11', label: 'Meeting notes prose', expected: 'card', title: 'Team offsite', content: 'We agreed the roadmap should prioritize capture quality before calendar integration.' },
  { id: '12', label: 'Definition', expected: 'card', title: 'Zettelkasten', content: 'A note-taking method built around atomic linked notes rather than hierarchical folders alone.' },
  { id: '13', label: 'Sermon idea', expected: 'card', title: 'Sermon idea', content: 'Joseph stored grain in plenty for famine — a model for intellectual preparation.' },
  { id: '14', label: 'Video timestamp note', expected: 'card', title: 'Lex Fridman clip', content: 'At 1:12:04 he argues curiosity beats credentials for sustained learning.' },
  { id: '15', label: 'Recipe as knowledge', expected: 'card', title: 'Sourdough principle', content: 'A healthy starter needs regular feeding; neglect changes the microbial balance.' },
  { id: '16', label: 'Errand bullets', expected: 'todo', title: 'Saturday errands', content: '- Buy milk\n- Pick up dry cleaning\n- Return library books' },
  { id: '17', label: 'Numbered chores', expected: 'todo', title: '', content: '1. Vacuum living room\n2. Water plants\n3. Take out recycling' },
  { id: '18', label: 'Project checklist', expected: 'todo', title: 'Launch blog', content: '- Draft outline\n- Edit intro\n- Publish post\n- Share on newsletter' },
  { id: '19', label: 'Single imperative', expected: 'todo', title: '', content: 'Call dentist to reschedule appointment' },
  { id: '20', label: 'Explicit todo list', expected: 'todo', title: 'Todo', content: 'Tasks before Friday:\n- finish taxes\n- email accountant\n- buy birthday gift' },
  { id: '21', label: 'Work sprint', expected: 'todo', title: 'Sprint 4', content: '- Fix inbox bug\n- Add stress test\n- Update docs' },
  { id: '22', label: 'Packing list', expected: 'todo', title: 'Trip packing', content: '- Passport\n- Chargers\n- Rain jacket\n- Notebook' },
  { id: '23', label: 'Morning routine', expected: 'todo', title: '', content: '1. Stretch\n2. Journal 10 minutes\n3. Review calendar' },
  { id: '24', label: 'Garden tasks', expected: 'todo', title: 'Garden', content: '- Prune roses\n- Mulch beds\n- Start tomato seeds indoors' },
  { id: '25', label: 'Shopping with due hint', expected: 'todo', title: 'Groceries by Friday', content: '- Eggs\n- Spinach\n- Coffee beans' },
  { id: '26', label: 'One bullet only', expected: 'ambiguous', title: '', content: '- Email James about the contract' },
  { id: '27', label: 'One short line', expected: 'ambiguous', title: '', content: 'Call dentist' },
  { id: '28', label: 'Title only task-ish', expected: 'ambiguous', title: 'Buy batteries', content: '' },
  { id: '29', label: 'Mixed paragraph + bullets', expected: 'ambiguous', title: 'Kitchen remodel thoughts', content: 'We need better lighting near the island.\n- Get quotes\n- Measure counter' },
  { id: '30', label: 'Question without action', expected: 'card', title: 'Open question', content: 'Is taste mostly pattern recognition accumulated over years?' },
  { id: '31', label: 'Card link mention', expected: 'todo', title: 'Follow up', content: '- Review card 0102a for filing policy\n- Draft summary' },
  { id: '32', label: 'Nested project tasks', expected: 'todo', title: 'Phase A wrap-up', content: 'Backend\n- stress test routing\n- document results\nApp\n- tag release' },
  { id: '33', label: 'Long quote', expected: 'card', title: 'Economics of attention', content: '"In an information-rich world, the wealth of information means a dearth of something else: a scarcity of whatever it is information consumes." — Herbert Simon' },
  { id: '34', label: 'Bullet journal style', expected: 'todo', title: 'This week', content: '• Write design doc\n• Review PR\n• Walk daily' },
  { id: '35', label: 'Idea that sounds like task', expected: 'card', title: 'Essay angle', content: 'Explore how todo apps fail open loops that are actually research questions.' },
  { id: '36', label: 'Multi-line card note', expected: 'card', title: 'Evergreen vs seed', content: 'Seed notes can stay rough. Evergreen notes should be clear enough that future-you needs no context rebuild.' },
  { id: '37', label: 'Checklist with dates', expected: 'todo', title: 'June deadlines', content: '- Submit insurance form by 2026-06-20\n- Pay HOA by 2026-06-25' },
  { id: '38', label: 'Voice memo style errands', expected: 'todo', title: '', content: 'pick up prescription, grab dog food, mail package at post office' },
  { id: '39', label: 'Source in sourceText field', expected: 'card', title: 'Humility', content: 'Pride goes before destruction.', sourceText: 'Proverbs 16:18' },
  { id: '40', label: 'Brain dump list', expected: 'todo', title: 'Brain dump', content: '- fix leaky faucet\n- read chapter 3\n- schedule oil change\n- text mom' },
  { id: '41', label: 'Philosophy claim', expected: 'card', title: '', content: 'Freedom is not the absence of constraint but the right constraint.' },
  { id: '42', label: 'Meeting action items', expected: 'todo', title: 'Actions from standup', content: '- Thomas: stress test\n- QA: verify inbox\n- Design: clarify modal copy' },
  { id: '43', label: 'Reading note', expected: 'card', title: 'Deep Work', content: 'Cal Newport argues that depth is becoming rarer and therefore more valuable.' },
  { id: '44', label: 'Single word title', expected: 'ambiguous', title: 'Laundry', content: 'Do before guests arrive' },
  { id: '45', label: 'Numbered ideas not tasks', expected: 'card', title: 'Essay bullets', content: '1. Taste is cultivated\n2. Tools shape attention\n3. Archives create serendipity' },
  { id: '46', label: 'Habit tracker', expected: 'todo', title: 'Daily habits', content: '- Meditate\n- Read 20 pages\n- No phone first hour' },
  { id: '47', label: 'News clipping', expected: 'card', title: 'AI regulation', content: 'EU AI Act emphasizes transparency for high-risk systems; implementation timelines vary by sector.' },
  { id: '48', label: 'Quick reminder', expected: 'todo', title: '', content: 'Water seedlings tonight' },
  { id: '49', label: 'Story seed', expected: 'card', title: 'Story idea', content: 'A librarian discovers notes written in her own handwriting from dates she does not remember.' },
  { id: '50', label: 'Ambiguous imperative proverb', expected: 'ambiguous', title: '', content: 'Trust but verify' },
];

function buildLocalSignals(title, content) {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
  let bulletLineCount = 0;
  let numberedLineCount = 0;
  for (const line of lines) {
    if (/^[-*•]\s+/.test(line)) bulletLineCount += 1;
    if (/^\d+[.)]\s+/.test(line)) numberedLineCount += 1;
  }
  const combined = `${title}\n${content}`;
  const hasSourceCues = /(https?:\/\/|www\.|page\s+\d|chapter\s+\d|—\s*[A-Z]|"\s*—|said\s+|according\s+to)/i.test(combined);
  const looksLikeQuote = lines.some(line => /^["'“‘].+["'”’]$/.test(line));
  return { bulletLineCount, numberedLineCount, hasSourceCues, looksLikeQuote };
}

function buildLocalDraftTodos(title, content) {
  const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
  const bullets = [];
  let index = 0;
  for (const line of lines) {
    const match = line.match(/^([-*•]|\d+[.)])\s+(.+)$/);
    if (match) {
      bullets.push({
        clientId: `local-${index}`,
        title: match[2],
        parentClientId: title.trim() ? 'parent' : '',
        sortOrder: index,
      });
      index += 1;
    }
  }
  if (bullets.length === 0 && content.trim()) {
    return [{
      clientId: 'local-0',
      title: title.trim() || content.trim(),
      parentClientId: '',
      sortOrder: 0,
    }];
  }
  if (title.trim() && bullets.length > 0) {
    return [
      { clientId: 'parent', title: title.trim(), parentClientId: '', sortOrder: 0 },
      ...bullets.map((item, bulletIndex) => ({
        ...item,
        parentClientId: 'parent',
        sortOrder: bulletIndex,
      })),
    ];
  }
  return bullets;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function postJson(path, body, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};
    return {
      ok: response.ok,
      status: response.status,
      data,
      latencyMs: Date.now() - startedAt,
      error: response.ok ? null : (data.error || `HTTP ${response.status}`),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {},
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function evaluateClassification(fixture, result) {
  if (!result) return { pass: false, reason: 'no result' };
  const { route, needsClarification, confidenceBand } = result;

  if (fixture.expected === 'ambiguous') {
    const pass = needsClarification || confidenceBand === 'low';
    return {
      pass,
      reason: pass ? 'clarification/low confidence' : `routed ${route} at ${confidenceBand} without clarification`,
    };
  }

  if (needsClarification) {
    return { pass: false, reason: 'unexpected clarification' };
  }

  const pass = route === fixture.expected;
  return {
    pass,
    reason: pass ? `routed ${route}` : `expected ${fixture.expected}, got ${route} (${confidenceBand})`,
  };
}

async function runFixture(fixture) {
  const capture = {
    id: `stress-${fixture.id}`,
    title: fixture.title || '',
    content: fixture.content || '',
    sourceText: fixture.sourceText || '',
    createdAt: new Date().toISOString(),
  };

  const pipelineStartedAt = Date.now();
  const classify = await postJson('/api/classify-capture', {
    capture,
    hints: {
      userOverride: null,
      localSignals: buildLocalSignals(capture.title, capture.content),
    },
  }, 15_000);

  const record = {
    id: fixture.id,
    label: fixture.label,
    expected: fixture.expected,
    classify: {
      ok: classify.ok,
      latencyMs: classify.latencyMs,
      route: classify.data?.result?.route,
      confidenceBand: classify.data?.result?.confidenceBand,
      needsClarification: classify.data?.result?.needsClarification,
      error: classify.error,
    },
    stage2: null,
    pipelineLatencyMs: 0,
    evaluation: { pass: false, reason: 'not run' },
  };

  if (!classify.ok || !classify.data?.result) {
    record.evaluation = { pass: false, reason: classify.error || 'classify failed' };
    record.pipelineLatencyMs = Date.now() - pipelineStartedAt;
    return record;
  }

  record.evaluation = evaluateClassification(fixture, classify.data.result);

  if (classify.data.result.needsClarification) {
    record.stage2 = { skipped: true, reason: 'awaiting_clarification' };
    record.pipelineLatencyMs = Date.now() - pipelineStartedAt;
    return record;
  }

  const route = classify.data.result.route;
  if (route === 'card') {
    const enrich = await postJson('/api/enrich-card-capture', {
      capture,
      localDraft: {
        suggestedTitle: capture.title,
        suggestedContent: capture.content,
        suggestedSource: { type: 'Other', title: '', author: '', url: '', page: '', note: capture.sourceText || '' },
        strategy: 'local',
      },
    }, 22_000);
    record.stage2 = {
      endpoint: 'enrich-card-capture',
      ok: enrich.ok,
      latencyMs: enrich.latencyMs,
      title: enrich.data?.result?.suggestedTitle,
      contentLength: enrich.data?.result?.suggestedContent?.length || 0,
      strategy: enrich.data?.result?.strategy,
      error: enrich.error,
    };
  } else {
    const generate = await postJson('/api/generate-todos', {
      capture,
      localDraft: {
        todos: buildLocalDraftTodos(capture.title, capture.content),
        strategy: 'local',
      },
      context: { existingCardAddresses: ['0102a', '0401b'] },
    }, 22_000);
    record.stage2 = {
      endpoint: 'generate-todos',
      ok: generate.ok,
      latencyMs: generate.latencyMs,
      todoCount: generate.data?.result?.todos?.length || 0,
      strategy: generate.data?.result?.strategy,
      error: generate.error,
    };
  }

  if (record.stage2 && !record.stage2.skipped && !record.stage2.ok) {
    record.evaluation = { pass: false, reason: record.stage2.error || 'stage 2 failed' };
  }

  record.pipelineLatencyMs = Date.now() - pipelineStartedAt;
  return record;
}

function printReport(results) {
  const classifyLatencies = results.map(r => r.classify.latencyMs).filter(Boolean);
  const stage2Latencies = results.map(r => r.stage2?.latencyMs).filter(n => typeof n === 'number');
  const pipelineLatencies = results.map(r => r.pipelineLatencyMs);

  const classifyOk = results.filter(r => r.classify.ok).length;
  const stage2Run = results.filter(r => r.stage2 && !r.stage2.skipped);
  const stage2Ok = stage2Run.filter(r => r.stage2.ok).length;
  const clarifications = results.filter(r => r.classify.needsClarification).length;
  const routingPass = results.filter(r => r.evaluation.pass).length;

  const byExpected = ['card', 'todo', 'ambiguous'].map(kind => {
    const subset = results.filter(r => r.expected === kind);
    const pass = subset.filter(r => r.evaluation.pass).length;
    return { kind, total: subset.length, pass, rate: subset.length ? (pass / subset.length * 100).toFixed(1) : 'n/a' };
  });

  console.log('\n=== Capture Routing Stress Test ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Fixtures: ${results.length}`);
  console.log(`Classify success: ${classifyOk}/${results.length}`);
  console.log(`Stage 2 success: ${stage2Ok}/${stage2Run.length} (${results.length - clarifications} routed)`);
  console.log(`Clarifications: ${clarifications} (${(clarifications / results.length * 100).toFixed(1)}%)`);
  console.log(`Routing evaluation pass: ${routingPass}/${results.length} (${(routingPass / results.length * 100).toFixed(1)}%)`);

  console.log('\nLatency (ms):');
  console.log(`  classify  p50=${percentile(classifyLatencies, 50)} p95=${percentile(classifyLatencies, 95)} max=${Math.max(...classifyLatencies, 0)}`);
  console.log(`  stage 2   p50=${percentile(stage2Latencies, 50)} p95=${percentile(stage2Latencies, 95)} max=${Math.max(...stage2Latencies, 0)}`);
  console.log(`  pipeline  p50=${percentile(pipelineLatencies, 50)} p95=${percentile(pipelineLatencies, 95)} max=${Math.max(...pipelineLatencies, 0)}`);

  console.log('\nBy expected route:');
  for (const row of byExpected) {
    console.log(`  ${row.kind.padEnd(10)} ${row.pass}/${row.total} (${row.rate}%)`);
  }

  const failures = results.filter(r => !r.evaluation.pass || !r.classify.ok || (r.stage2 && !r.stage2.skipped && !r.stage2.ok));
  if (failures.length > 0) {
    console.log('\nFailures / misses:');
    for (const row of failures) {
      console.log(`  [${row.id}] ${row.label}`);
      console.log(`       expected=${row.expected} route=${row.classify.route || '-'} clarify=${row.classify.needsClarification} eval=${row.evaluation.reason}`);
      if (row.classify.error) console.log(`       classify error: ${row.classify.error}`);
      if (row.stage2?.error) console.log(`       stage2 error: ${row.stage2.error}`);
    }
  }

  const slow = [...results].sort((a, b) => b.pipelineLatencyMs - a.pipelineLatencyMs).slice(0, 5);
  console.log('\nSlowest pipelines:');
  for (const row of slow) {
    console.log(`  [${row.id}] ${row.pipelineLatencyMs}ms — ${row.label} (${row.classify.route || 'n/a'}, stage2=${row.stage2?.endpoint || row.stage2?.reason || 'n/a'})`);
  }
}

async function main() {
  try {
    const healthRes = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!healthRes.ok) throw new Error(`health ${healthRes.status}`);
  } catch (error) {
    console.error(`AI server not reachable at ${BASE_URL}. Start it with: npm run ai-server`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log(`Running ${CAPTURE_FIXTURES.length} capture routing stress fixtures against ${BASE_URL}...`);
  const results = [];
  for (const fixture of CAPTURE_FIXTURES) {
    process.stdout.write(`  [${fixture.id}] ${fixture.label}... `);
    const result = await runFixture(fixture);
    results.push(result);
    const status = result.evaluation.pass ? 'PASS' : 'MISS';
    const latency = result.pipelineLatencyMs;
    console.log(`${status} (${latency}ms, ${result.classify.route || '?'})`);
  }

  printReport(results);

  const hardFailures = results.filter(r => !r.classify.ok || (r.stage2 && !r.stage2.skipped && !r.stage2.ok));
  if (hardFailures.length > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});