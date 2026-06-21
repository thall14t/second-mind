#!/usr/bin/env node
// Mini stress test — 25 fresh fixtures, never used before
// Usage: node scripts/run-mini-stress-test.js [server-url]

const BASE_URL = (process.argv[2] || 'http://127.0.0.1:3001').replace(/\/+$/, '');

const fixtures = [
  // ── Knowledge cards ──
  {
    id: 'K01', label: 'Famous Chesterton quote',
    expected: 'card',
    title: '', content: 'The Christian ideal has not been tried and found wanting. It has been found difficult and left untried. — G.K. Chesterton',
    checks: r => r.suggestedTitle?.length > 0 && r.suggestedSource?.author?.toLowerCase().includes('chesterton'),
  },
  {
    id: 'K02', label: 'Neuroscience finding',
    expected: 'card',
    title: 'sleep and memory', content: 'During slow-wave sleep the hippocampus replays memories and transfers them to the neocortex for long-term storage. This is why pulling an all-nighter before an exam backfires.',
    checks: r => r.suggestedTitle?.length > 0 && r.suggestedContent?.length > r.suggestedTitle?.length,
  },
  {
    id: 'K03', label: 'Parenting observation — card',
    expected: 'card',
    title: 'on raising kids', content: 'Children need presence more than presents. The moments that matter most are the unremarkable Tuesday evenings when you show up.',
    checks: r => r.suggestedTitle?.length > 0,
  },
  {
    id: 'K04', label: 'Definition note',
    expected: 'card',
    title: 'antifragility', content: 'Nassim Taleb: things that gain from disorder. Not resilience (withstands shocks) but antifragile (gets stronger from them). Example: immune system, muscles, startups.',
    checks: r => r.suggestedSource?.author?.toLowerCase().includes('taleb') || r.suggestedContent?.toLowerCase().includes('taleb'),
  },
  {
    id: 'K05', label: 'Movie quote',
    expected: 'card',
    title: '', content: '"Get busy living, or get busy dying." — Red, The Shawshank Redemption',
    checks: r => r.suggestedSource?.title?.toLowerCase().includes('shawshank') || r.suggestedContent?.toLowerCase().includes('shawshank'),
  },
  {
    id: 'K06', label: 'Business model insight',
    expected: 'card',
    title: 'razor and blade model', content: 'Sell the razor cheap, make money on blades. Gillette invented this. Modern examples: printers/ink, Keurig/pods, gaming consoles/games. The platform is a loss leader.',
    checks: r => r.suggestedTitle?.length > 0 && r.suggestedTags?.length > 0,
  },
  {
    id: 'K07', label: 'Podcast timestamp note',
    expected: 'card',
    title: '', content: 'Huberman Lab at 42:15 — cold exposure for 11 minutes per week across 2-4 sessions is the minimum effective dose for dopamine and norepinephrine boost. Does not have to be ice bath.',
    checks: r => r.suggestedSource?.author?.toLowerCase().includes('huberman') || r.suggestedSource?.page === '42:15',
  },
  {
    id: 'K08', label: 'Spanish capture',
    expected: 'card',
    title: '', content: 'La vida es sueño, y los sueños, sueños son. — Calderón de la Barca, La vida es sueño',
    checks: r => r.suggestedTitle?.length > 0,
  },
  {
    id: 'K09', label: 'Theological reflection',
    expected: 'card',
    title: 'incarnation', content: 'The Word became flesh — not a metaphor, not a symbol. God entered the particular. A specific baby, a specific manger, a specific night. Christianity is the religion of the concrete.',
    checks: r => r.suggestedTitle?.length > 0 && r.suggestedStatus,
  },
  {
    id: 'K10', label: 'Therapy insight',
    expected: 'card',
    title: '', content: 'My therapist said: emotions are not problems to solve, they are information to process. When I try to fix my anxiety I make it worse. When I get curious about it, it moves through.',
    checks: r => r.suggestedTitle?.length > 0 && r.suggestedContent?.length > 0,
  },

  // ── Todo lists ──
  {
    id: 'T01', label: 'Morning routine setup',
    expected: 'todo',
    title: 'morning routine', content: 'Wake at 5:30, no phone for first hour, journal 10 minutes, cold shower, read Bible, make coffee before checking email',
    checks: r => r.todos?.length >= 4,
  },
  {
    id: 'T02', label: 'Home repair project',
    expected: 'todo',
    title: '', content: 'Fix the back porch including replacing two rotten boards, sanding the railing, and repainting the floor. Need to finish before dad visits July 4th.',
    checks: r => r.todos?.length >= 3 && r.todos?.some(t => t.dueDate),
  },
  {
    id: 'T03', label: 'Grocery run voice-style',
    expected: 'todo',
    title: '', content: 'almond milk greek yogurt sourdough bread sharp cheddar rotisserie chicken spinach cherry tomatoes olive oil coffee filters trash bags',
    checks: r => r.todos?.length >= 6,
  },
  {
    id: 'T04', label: 'Work sprint tasks',
    expected: 'todo',
    title: 'sprint tasks this week', content: '- Finish the onboarding flow mockups\n- Review PRs from Jake and Sarah\n- Send Q3 metrics to leadership by Thursday\n- Schedule 1:1 with new hire\n- Update the roadmap doc',
    checks: r => r.todos?.length >= 4,
  },
  {
    id: 'T05', label: 'Multi-project dump',
    expected: 'todo',
    title: '', content: 'I need to prep for the camping trip including buying a new tent, packing food, and reserving the site. I also need to handle the car including oil change and tire pressure check. And I need to wrap Emma\'s birthday present and write a card.',
    checks: r => r.todos?.filter(t => !t.parentClientId || t.parentClientId === '').length >= 3,
  },
  {
    id: 'T06', label: 'Deadline-heavy task list',
    expected: 'todo',
    title: 'June deadlines', content: 'Submit tax extension by June 30. Pay water bill before June 25. Return library books by June 22. RSVP to wedding by June 20.',
    checks: r => r.todos?.filter(t => t.dueDate).length >= 2,
  },
  {
    id: 'T07', label: 'Fitness plan',
    expected: 'todo',
    title: 'gym week', content: 'Monday: chest and triceps. Wednesday: back and biceps. Friday: legs. Saturday: 30 minute run. Every day: 10 min stretching before bed.',
    checks: r => r.todos?.length >= 4,
  },
  {
    id: 'T08', label: 'Single urgent task',
    expected: 'todo',
    title: '', content: 'Call the insurance company before 5pm today about the claim',
    checks: r => r.todos?.length >= 1,
  },

  // ── Hard / edge cases ──
  {
    id: 'E01', label: 'Numbered idea list — NOT tasks',
    expected: 'card',
    title: 'book ideas', content: '1. The psychology of why we resist good advice\n2. How cities shape personality\n3. The theology of boredom\n4. Why amateurs often beat experts',
    checks: r => true,
  },
  {
    id: 'E02', label: 'Imperative aphorism — card',
    expected: 'card',
    title: '', content: 'Speak only what you would be willing to sign your name to.',
    checks: r => true,
  },
  {
    id: 'E03', label: 'Meeting with action items mixed in',
    expected: 'todo',
    title: 'team meeting notes', content: 'Discussed Q3 goals. Revenue is tracking 12% ahead. Jake will update the dashboard. Sarah needs to send the client proposal by Friday. I need to follow up with the design team about the new logo.',
    checks: r => r.todos?.length >= 2,
  },
  {
    id: 'E04', label: 'Long dense knowledge note',
    expected: 'card',
    title: 'on habit formation', content: 'James Clear argues that habits are the compound interest of self-improvement. A 1% improvement daily yields 37x improvement in a year. The key insight is that you don\'t rise to the level of your goals, you fall to the level of your systems. Identity-based habits (I am a reader) are more durable than outcome-based habits (I want to read more). Every action is a vote for the kind of person you want to become.',
    checks: r => r.suggestedTitle?.length > 0 && r.suggestedContent?.length > 50,
  },
  {
    id: 'E05', label: 'Emoji-heavy todo',
    expected: 'todo',
    title: '', content: '✅ Buy birthday cake 🎂\n✅ Pick up balloons 🎈\n✅ Call the venue 📞\n✅ Print the photos 📸\n✅ Get ice and drinks 🥤',
    checks: r => r.todos?.length >= 4,
  },
  {
    id: 'E06', label: 'URL-only capture',
    expected: 'card',
    title: '', content: 'https://paulgraham.com/greatwork.html',
    checks: r => r.suggestedSource?.url?.length > 0 || r.suggestedTitle?.length > 0,
  },
  {
    id: 'E07', label: 'Voice memo ramble with tasks buried in prose',
    expected: 'todo',
    title: '', content: 'ok so I was thinking I really need to get the basement sorted out before winter. like I should move the storage shelves, get rid of the old furniture, fix that leaking pipe in the corner, and maybe paint the floor if there\'s time. oh and I need to buy a dehumidifier.',
    checks: r => r.todos?.length >= 3,
  },
];

async function classify(fixture) {
  const res = await fetch(`${BASE_URL}/api/route-and-enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capture: { id: fixture.id, title: fixture.title, content: fixture.content, createdAt: new Date().toISOString() },
      hints: { localSignals: { bulletLineCount: 0, numberedLineCount: 0, hasSourceCues: false, looksLikeQuote: false } },
      heuristicHints: { todos: [], confidence: 'low', scope: 'list_shapes_only', note: '' },
      context: { existingCards: [], existingCardAddresses: [], existingTodos: [] },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { result } = await res.json();
  return result;
}

async function run() {
  console.log(`\nChecking server at ${BASE_URL}...`);
  try {
    const h = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(10000) });
    if (!h.ok) throw new Error(`Health check failed: ${h.status}`);
    console.log('OK\n');
  } catch (e) {
    console.error(`Server not reachable: ${e.message}`);
    process.exit(1);
  }

  console.log(`Running ${fixtures.length} fixtures against /api/route-and-enrich...\n`);

  let passed = 0;
  let routePassed = 0;
  const latencies = [];
  const failures = [];

  for (const fixture of fixtures) {
    const start = Date.now();
    let result, error;
    try {
      result = await classify(fixture);
    } catch (e) {
      error = e.message;
    }
    const ms = Date.now() - start;
    latencies.push(ms);

    const classification = result?.classification;
    const enrichment = result?.enrichment;
    const todos = result?.todoGeneration?.todos;

    const routeOk = classification?.route === fixture.expected;
    if (routeOk) routePassed++;

    const secondStage = fixture.expected === 'card' ? enrichment : { todos };
    const qualityOk = !error && routeOk && (!fixture.checks || fixture.checks(fixture.expected === 'card' ? enrichment : result?.todoGeneration));

    if (routeOk && qualityOk) passed++;

    const icon = routeOk && qualityOk ? 'PASS' : 'FAIL';
    const route = classification?.route ?? '?';
    const band = classification?.confidenceBand ?? '?';
    console.log(`  [${fixture.id}] ${fixture.label.padEnd(42)} ${icon} ${ms}ms | route=${route} band=${band}`);

    if (error) {
      console.log(`         ↳ error: ${error}`);
      failures.push({ fixture, reason: error });
    } else if (!routeOk) {
      console.log(`         ↳ wrong route: expected ${fixture.expected}, got ${route}`);
      failures.push({ fixture, reason: `expected ${fixture.expected} got ${route}` });
    } else if (!qualityOk) {
      console.log(`         ↳ quality check failed`);
      failures.push({ fixture, reason: 'quality check failed' });
    }
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];

  console.log('\n' + '='.repeat(50));
  console.log('MINI STRESS TEST COMPLETE');
  console.log('='.repeat(50));
  console.log(`Overall pass:        ${passed}/${fixtures.length} (${Math.round(passed / fixtures.length * 100)}%)`);
  console.log(`Route pass:          ${routePassed}/${fixtures.length} (${Math.round(routePassed / fixtures.length * 100)}%)`);
  console.log(`Pipeline p50/p95:    ${p50}ms / ${p95}ms`);
  if (failures.length > 0) {
    console.log(`\nFailures:`);
    failures.forEach(f => console.log(`  [${f.fixture.id}] ${f.fixture.label} — ${f.reason}`));
  }
  console.log('');
}

run().catch(e => { console.error(e); process.exit(1); });
