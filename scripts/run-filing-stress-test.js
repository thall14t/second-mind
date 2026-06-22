#!/usr/bin/env node
// Filing pipeline stress test — /api/suggest-card-filing
// Usage: node scripts/run-filing-stress-test.js [server-url]

const BASE_URL = (process.argv[2] || 'http://127.0.0.1:3001').replace(/\/+$/, '');

// ─── Category tree (default Antinet taxonomy) ───────────────────────────────

const topLevelCategories = [
  {
    id: '0000', title: 'Philosophy and Ethics', range: '0000-0999', isLeaf: false,
    children: [
      { id: '0000-0099', title: 'Metaphysics', range: '0000-0099', isLeaf: false, children: [
        { id: '0001', title: 'Natural Laws', range: '0001', isLeaf: true, children: [] },
      ] },
      { id: '0100-0199', title: 'Epistemology', range: '0100-0199', isLeaf: false, children: [
        { id: '0101', title: 'Wisdom', range: '0101', isLeaf: true, children: [] },
        { id: '0102', title: 'Knowledge', range: '0102', isLeaf: true, children: [] },
      ] },
      { id: '0200-0299', title: 'Logic and Reasoning', range: '0200-0299', isLeaf: false, children: [] },
      { id: '0300-0399', title: 'Ethics and Morality', range: '0300-0399', isLeaf: false, children: [
        { id: '0301', title: 'Ethical Action', range: '0301', isLeaf: true, children: [] },
      ] },
      { id: '0400-0499', title: 'Political Philosophy', range: '0400-0499', isLeaf: false, children: [] },
      { id: '0500-0599', title: 'Aesthetics and Philosophy of Art', range: '0500-0599', isLeaf: false, children: [
        { id: '0501', title: 'Creative Process', range: '0501', isLeaf: true, children: [] },
      ] },
      { id: '0600-0699', title: 'Philosophy of Mind', range: '0600-0699', isLeaf: false, children: [
        { id: '0601', title: 'Intellectual Pursuit', range: '0601', isLeaf: true, children: [] },
      ] },
      { id: '0700-0799', title: 'Existentialism and Phenomenology', range: '0700-0799', isLeaf: false, children: [] },
      { id: '0800-0899', title: 'Philosophy of Religion', range: '0800-0899', isLeaf: false, children: [] },
      { id: '0900-0999', title: 'Applied Ethics', range: '0900-0999', isLeaf: false, children: [] },
    ],
  },
  {
    id: '1000', title: 'History and Civilization', range: '1000-1999', isLeaf: false,
    children: [
      { id: '1000-1099', title: 'Prehistory and Early Human Civilizations', range: '1000-1099', isLeaf: false, children: [] },
      { id: '1100-1199', title: 'Ancient History', range: '1100-1199', isLeaf: false, children: [] },
      { id: '1200-1299', title: 'Medieval History', range: '1200-1299', isLeaf: false, children: [] },
      { id: '1300-1399', title: 'Early Modern History', range: '1300-1399', isLeaf: false, children: [] },
      { id: '1400-1499', title: 'Modern History', range: '1400-1499', isLeaf: false, children: [] },
      { id: '1500-1599', title: 'Political History', range: '1500-1599', isLeaf: false, children: [] },
      { id: '1600-1699', title: 'Economic History', range: '1600-1699', isLeaf: false, children: [] },
      { id: '1700-1799', title: 'Social and Cultural History', range: '1700-1799', isLeaf: false, children: [] },
      { id: '1800-1899', title: 'History of Science, Technology, and Medicine', range: '1800-1899', isLeaf: false, children: [] },
      { id: '1900-1999', title: 'Historiography and Historical Methodology', range: '1900-1999', isLeaf: false, children: [] },
    ],
  },
  {
    id: '2000', title: 'Science and Nature', range: '2000-2999', isLeaf: false,
    children: [
      { id: '2000-2099', title: 'Physics', range: '2000-2099', isLeaf: false, children: [] },
      { id: '2100-2199', title: 'Chemistry', range: '2100-2199', isLeaf: false, children: [] },
      { id: '2200-2299', title: 'Biology', range: '2200-2299', isLeaf: false, children: [] },
      { id: '2300-2399', title: 'Earth Sciences', range: '2300-2399', isLeaf: false, children: [] },
      { id: '2400-2499', title: 'Astronomy and Space Science', range: '2400-2499', isLeaf: false, children: [] },
      { id: '2500-2599', title: 'Ecology and Environmental Science', range: '2500-2599', isLeaf: false, children: [] },
      { id: '2600-2699', title: 'Mathematics and Statistics', range: '2600-2699', isLeaf: false, children: [] },
      { id: '2700-2799', title: 'Medicine and Health Sciences', range: '2700-2799', isLeaf: false, children: [] },
      { id: '2800-2899', title: 'Computer Science and Artificial Intelligence', range: '2800-2899', isLeaf: false, children: [] },
      { id: '2900-2999', title: 'Interdisciplinary and Applied Sciences', range: '2900-2999', isLeaf: false, children: [] },
    ],
  },
  {
    id: '3000', title: 'Psychology and Human Behavior', range: '3000-3999', isLeaf: false,
    children: [
      { id: '3000-3099', title: 'Cognitive Psychology', range: '3000-3099', isLeaf: false, children: [
        { id: '3001', title: 'Linguistics', range: '3001', isLeaf: true, children: [] },
      ] },
      { id: '3100-3199', title: 'Behavioral Psychology', range: '3100-3199', isLeaf: false, children: [] },
      { id: '3200-3299', title: 'Developmental Psychology', range: '3200-3299', isLeaf: false, children: [] },
      { id: '3300-3399', title: 'Personality Psychology', range: '3300-3399', isLeaf: false, children: [] },
      { id: '3400-3499', title: 'Social Psychology', range: '3400-3499', isLeaf: false, children: [] },
      { id: '3500-3599', title: 'Emotions and Motivation', range: '3500-3599', isLeaf: false, children: [
        { id: '3501', title: 'Success', range: '3501', isLeaf: true, children: [] },
      ] },
      { id: '3600-3699', title: 'Clinical Psychology', range: '3600-3699', isLeaf: false, children: [] },
      { id: '3700-3799', title: 'Neuroscience and Biological Psychology', range: '3700-3799', isLeaf: false, children: [] },
      { id: '3800-3899', title: 'Health and Positive Psychology', range: '3800-3899', isLeaf: false, children: [] },
      { id: '3900-3999', title: 'Industrial-Organizational and Applied Psychology', range: '3900-3999', isLeaf: false, children: [] },
    ],
  },
  {
    id: '4000', title: 'Sociology and Culture', range: '4000-4999', isLeaf: false,
    children: [
      { id: '4000-4099', title: 'Foundations of Sociology', range: '4000-4099', isLeaf: false, children: [] },
      { id: '4100-4199', title: 'Social Stratification and Class', range: '4100-4199', isLeaf: false, children: [] },
      { id: '4200-4299', title: 'Sex, Gender Roles, and Biological Differences', range: '4200-4299', isLeaf: false, children: [] },
      { id: '4300-4399', title: 'Race and Ethnicity', range: '4300-4399', isLeaf: false, children: [] },
      { id: '4400-4499', title: 'Family and Relationships', range: '4400-4499', isLeaf: false, children: [] },
      { id: '4500-4599', title: 'Religion and Belief Systems', range: '4500-4599', isLeaf: false, children: [] },
      { id: '4600-4699', title: 'Culture, Media, and Communication', range: '4600-4699', isLeaf: false, children: [
        { id: '4601', title: 'Etymology', range: '4601', isLeaf: true, children: [] },
        { id: '4602', title: 'Journalism', range: '4602', isLeaf: true, children: [] },
      ] },
      { id: '4700-4799', title: 'Urbanization and Communities', range: '4700-4799', isLeaf: false, children: [] },
      { id: '4800-4899', title: 'Education and Socialization', range: '4800-4899', isLeaf: false, children: [] },
      { id: '4900-4999', title: 'Deviance, Crime, and Social Control', range: '4900-4999', isLeaf: false, children: [] },
    ],
  },
  {
    id: '5000', title: 'Politics, Law, and Governance', range: '5000-5999', isLeaf: false,
    children: [
      { id: '5000-5099', title: 'Political Theory', range: '5000-5099', isLeaf: false, children: [] },
      { id: '5100-5199', title: 'Comparative Politics', range: '5100-5199', isLeaf: false, children: [] },
      { id: '5200-5299', title: 'International Relations', range: '5200-5299', isLeaf: false, children: [] },
      { id: '5300-5399', title: 'Public Policy and Administration', range: '5300-5399', isLeaf: false, children: [] },
      { id: '5400-5499', title: 'Constitutional Law', range: '5400-5499', isLeaf: false, children: [] },
      { id: '5500-5599', title: 'Criminal Law and Justice', range: '5500-5599', isLeaf: false, children: [] },
      { id: '5600-5699', title: 'Human Rights and Civil Liberties', range: '5600-5699', isLeaf: false, children: [] },
      { id: '5700-5799', title: 'Political Economy', range: '5700-5799', isLeaf: false, children: [] },
      { id: '5800-5899', title: 'Political Behavior and Public Opinion', range: '5800-5899', isLeaf: false, children: [] },
      { id: '5900-5999', title: 'Governance and Development', range: '5900-5999', isLeaf: false, children: [] },
    ],
  },
  {
    id: '6000', title: 'Economics and Finance', range: '6000-6999', isLeaf: false,
    children: [
      { id: '6000-6099', title: 'Microeconomics', range: '6000-6099', isLeaf: false, children: [] },
      { id: '6100-6199', title: 'Macroeconomics', range: '6100-6199', isLeaf: false, children: [] },
      { id: '6200-6299', title: 'International Economics', range: '6200-6299', isLeaf: false, children: [] },
      { id: '6300-6399', title: 'Development Economics', range: '6300-6399', isLeaf: false, children: [] },
      { id: '6400-6499', title: 'Behavioral Economics', range: '6400-6499', isLeaf: false, children: [] },
      { id: '6500-6599', title: 'Financial Economics', range: '6500-6599', isLeaf: false, children: [] },
      { id: '6600-6699', title: 'Public Finance', range: '6600-6699', isLeaf: false, children: [] },
      { id: '6700-6799', title: 'Labor Economics', range: '6700-6799', isLeaf: false, children: [] },
      { id: '6800-6899', title: 'Environmental Economics', range: '6800-6899', isLeaf: false, children: [] },
      { id: '6900-6999', title: 'Economic History and Thought', range: '6900-6999', isLeaf: false, children: [] },
    ],
  },
  {
    id: '7000', title: 'Art and Aesthetics', range: '7000-7999', isLeaf: false,
    children: [
      { id: '7000-7099', title: 'History of Art', range: '7000-7099', isLeaf: false, children: [] },
      { id: '7100-7199', title: 'Art Theory and Criticism', range: '7100-7199', isLeaf: false, children: [] },
      { id: '7200-7299', title: 'Visual Arts', range: '7200-7299', isLeaf: false, children: [] },
      { id: '7300-7399', title: 'Performing Arts', range: '7300-7399', isLeaf: false, children: [] },
      { id: '7400-7499', title: 'Literary Arts', range: '7400-7499', isLeaf: false, children: [] },
      { id: '7500-7599', title: 'Applied Arts and Design', range: '7500-7599', isLeaf: false, children: [] },
      { id: '7600-7699', title: 'Cultural Aesthetics', range: '7600-7699', isLeaf: false, children: [] },
      { id: '7700-7799', title: 'Art and Technology', range: '7700-7799', isLeaf: false, children: [] },
      { id: '7800-7899', title: 'Art and Society', range: '7800-7899', isLeaf: false, children: [] },
      { id: '7900-7999', title: 'Art Education and Engagement', range: '7900-7999', isLeaf: false, children: [] },
    ],
  },
  {
    id: '8000', title: 'Technology and Innovation', range: '8000-8999', isLeaf: false,
    children: [
      { id: '8000-8099', title: 'History of Technology', range: '8000-8099', isLeaf: false, children: [] },
      { id: '8100-8199', title: 'Information Technology', range: '8100-8199', isLeaf: false, children: [] },
      { id: '8200-8299', title: 'Communication Technology', range: '8200-8299', isLeaf: false, children: [] },
      { id: '8300-8399', title: 'Engineering and Manufacturing', range: '8300-8399', isLeaf: false, children: [] },
      { id: '8400-8499', title: 'Biotechnology and Health Technology', range: '8400-8499', isLeaf: false, children: [] },
      { id: '8500-8599', title: 'Energy Technology', range: '8500-8599', isLeaf: false, children: [] },
      { id: '8600-8699', title: 'Environmental Technology', range: '8600-8699', isLeaf: false, children: [] },
      { id: '8700-8799', title: 'Transportation Technology', range: '8700-8799', isLeaf: false, children: [] },
      { id: '8800-8899', title: 'Emerging Technologies', range: '8800-8899', isLeaf: false, children: [] },
      { id: '8900-8999', title: 'Technology and Society', range: '8900-8999', isLeaf: false, children: [] },
    ],
  },
  {
    id: '9000', title: 'Personal Development and Practical Skills', range: '9000-9999', isLeaf: false,
    children: [
      { id: '9000-9099', title: 'Self-Awareness and Personal Growth', range: '9000-9099', isLeaf: false, children: [
        { id: '9001', title: 'Personal Philosophy', range: '9001', isLeaf: true, children: [] },
        { id: '9002', title: 'Clarity and Decision Making', range: '9002', isLeaf: true, children: [] },
        { id: '9003', title: 'Agency', range: '9003', isLeaf: true, children: [] },
        { id: '9004', title: 'Purpose', range: '9004', isLeaf: true, children: [] },
      ] },
      { id: '9100-9199', title: 'Time Management and Productivity', range: '9100-9199', isLeaf: false, children: [
        { id: '9101', title: 'Reading', range: '9101', isLeaf: true, children: [] },
        { id: '9102', title: 'Intentional Time Management', range: '9102', isLeaf: true, children: [] },
      ] },
      { id: '9200-9299', title: 'Learning and Skill Development', range: '9200-9299', isLeaf: false, children: [] },
      { id: '9300-9399', title: 'Health and Wellness', range: '9300-9399', isLeaf: false, children: [] },
      { id: '9400-9499', title: 'Relationships and Communication', range: '9400-9499', isLeaf: false, children: [] },
      { id: '9500-9599', title: 'Leadership and Influence', range: '9500-9599', isLeaf: false, children: [] },
      { id: '9600-9699', title: 'Entrepreneurship and Career', range: '9600-9699', isLeaf: false, children: [] },
      { id: '9700-9799', title: 'Financial Literacy and Personal Finance', range: '9700-9799', isLeaf: false, children: [] },
      { id: '9800-9899', title: 'Practical Life Skills', range: '9800-9899', isLeaf: false, children: [] },
      { id: '9900-9999', title: 'Spirituality and Meaning', range: '9900-9999', isLeaf: false, children: [] },
    ],
  },
];

// ─── Helper: parse the thousands digit of a range ────────────────────────────

function masterRangeFirstDigit(range) {
  if (!range) return '';
  return range.charAt(0);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// Each fixture has a draft and an array of acceptable master-range first digits.
// The check verifies: mode is not manual_review, confidence >= 0.4,
// and selectedMasterRange starts with one of the acceptable digits.

const fixtures = [
  {
    id: 'F01', label: 'Chesterton on Christianity',
    draft: {
      title: 'The Christian ideal left untried',
      content: 'The Christian ideal has not been tried and found wanting. It has been found difficult and left untried. — G.K. Chesterton',
      tags: ['Christianity', 'Chesterton', 'apologetics'],
      source: { type: 'Book', title: '', author: 'G.K. Chesterton', page: '' },
    },
    acceptableDigits: ['0', '4'],
    note: 'Philosophy of Religion or Religion and Belief Systems',
  },
  {
    id: 'F02', label: 'Sleep and memory consolidation',
    draft: {
      title: 'Hippocampus transfers memories during slow-wave sleep',
      content: 'During slow-wave sleep the hippocampus replays memories and transfers them to the neocortex for long-term storage. All-nighters before exams backfire because they cut this transfer window.',
      tags: ['sleep', 'memory', 'neuroscience', 'learning'],
      source: { type: 'Other', title: '', author: '', page: '' },
    },
    acceptableDigits: ['2', '3'],
    note: 'Neuroscience (3700) or Medicine (2700)',
  },
  {
    id: 'F03', label: 'Parenting: presence over presents',
    draft: {
      title: 'Children need presence more than presents',
      content: 'The moments that shape children most are not the holidays or vacations but the unremarkable Tuesday evenings when you show up. Presence is the gift that makes all others meaningful.',
      tags: ['parenting', 'family', 'presence'],
      source: { type: 'Other', title: '', author: '', page: '' },
    },
    acceptableDigits: ['4', '3', '9'],
    note: 'Family and Relationships (4400) or Developmental Psychology (3200)',
  },
  {
    id: 'F04', label: 'Antifragility — Taleb',
    draft: {
      title: 'Antifragility: things that gain from disorder',
      content: 'Nassim Taleb\'s concept: some systems gain from stressors and shocks. Antifragility is not resilience (withstands) but active gain from volatility. Examples: immune system, muscles, decentralized economies.',
      tags: ['Taleb', 'antifragility', 'resilience', 'complexity'],
      source: { type: 'Book', title: 'Antifragile', author: 'Nassim Taleb', page: '' },
    },
    acceptableDigits: ['0', '3', '6', '9'],
    note: 'Philosophy, Psychology, Economics, or Personal Development',
  },
  {
    id: 'F05', label: 'Razor and blade business model',
    draft: {
      title: 'Razor-and-blade: loss leader platform strategy',
      content: 'Sell the core product cheap, make profits on consumables. Gillette invented it. Modern variants: printers/ink, Keurig/pods, consoles/games. The hardware is a loss leader that locks in repeat purchase.',
      tags: ['business model', 'pricing strategy', 'platform', 'Gillette'],
      source: { type: 'Other', title: '', author: '', page: '' },
    },
    acceptableDigits: ['6', '9'],
    note: 'Microeconomics (6000) or Entrepreneurship (9600)',
  },
  {
    id: 'F06', label: 'Huberman cold exposure protocol',
    draft: {
      title: '11 minutes cold per week for dopamine boost',
      content: '11 minutes total cold exposure per week, split across 2–4 sessions, is the minimum effective dose for a meaningful dopamine and norepinephrine increase. Does not require ice bath — cold shower works.',
      tags: ['dopamine', 'cold exposure', 'neuroscience', 'health protocol'],
      source: { type: 'Other', title: 'Huberman Lab', author: 'Andrew Huberman', page: '42:15' },
    },
    acceptableDigits: ['2', '3', '9'],
    note: 'Medicine (2700), Neuroscience (3700), or Health/Wellness (9300)',
  },
  {
    id: 'F07', label: 'Identity-based habits — James Clear',
    draft: {
      title: 'Identity-based habits outperform outcome-based habits',
      content: 'James Clear: "I am a runner" is more durable than "I want to run more." Every action is a vote for the kind of person you want to become. Identity-based habits align the behavior with the self-concept.',
      tags: ['habits', 'identity', 'behavior change', 'Atomic Habits'],
      source: { type: 'Book', title: 'Atomic Habits', author: 'James Clear', page: '' },
    },
    acceptableDigits: ['3', '9'],
    note: 'Behavioral Psychology (3100) or Self-Awareness (9000)',
  },
  {
    id: 'F08', label: 'Therapy insight: emotions as information',
    draft: {
      title: 'Emotions are information, not problems to fix',
      content: 'My therapist: when you try to solve an emotion you amplify it. When you get curious about it — "where do I feel this in my body, what is it trying to tell me" — it moves through. Anxiety treated as data rather than threat.',
      tags: ['therapy', 'emotions', 'anxiety', 'mindfulness'],
      source: { type: 'Other', title: '', author: '', page: '' },
    },
    acceptableDigits: ['3', '9'],
    note: 'Emotions and Motivation (3500) or Clinical Psychology (3600)',
  },
  {
    id: 'F09', label: 'The Incarnation — theological note',
    draft: {
      title: 'The Incarnation: God entered the particular',
      content: 'The Word became flesh — not metaphor, not symbol. God entered the particular: a specific baby, a specific manger, a specific night. Christianity is the religion of the concrete, the embodied, the irreducibly local.',
      tags: ['incarnation', 'theology', 'Christianity', 'doctrine'],
      source: { type: 'Other', title: '', author: '', page: '' },
    },
    acceptableDigits: ['0', '4'],
    note: 'Philosophy of Religion (0800) or Religion and Belief Systems (4500)',
  },
  {
    id: 'F10', label: 'Fall of Rome — internal decay thesis',
    draft: {
      title: 'Rome fell from internal decay, not barbarians alone',
      content: 'Edward Gibbon and later historians argue Rome\'s fall was principally internal: fiscal overextension, military overcommitment, debasement of currency, loss of civic virtue, and political fragmentation. Barbarian invasions exploited an already-weakened system.',
      tags: ['Rome', 'decline', 'history', 'Gibbon'],
      source: { type: 'Book', title: 'The History of the Decline and Fall of the Roman Empire', author: 'Edward Gibbon', page: '' },
    },
    acceptableDigits: ['1'],
    note: 'Ancient History (1100) or Political History (1500)',
  },
  {
    id: 'F11', label: 'AI displacing knowledge workers',
    draft: {
      title: 'AI shifts labor demand away from routine cognitive tasks',
      content: 'Large language models automate tasks once thought safe: drafting, summarizing, coding, legal research. Displacement hits not just blue-collar work but white-collar cognitive labor. The economic effect may be faster than previous technological transitions.',
      tags: ['AI', 'labor', 'automation', 'knowledge workers'],
      source: { type: 'Other', title: '', author: '', page: '' },
    },
    acceptableDigits: ['6', '8'],
    note: 'Labor Economics (6700) or Technology and Society (8900)',
  },
  {
    id: 'F12', label: 'Compounding effect of small daily decisions',
    draft: {
      title: 'Small decisions compound into character over time',
      content: 'A 1% improvement daily yields 37x in a year. But the inverse is also true. The decisions that define you are not the dramatic ones — they are the small choices made on ordinary days when no one is watching.',
      tags: ['compounding', 'habits', 'character', 'discipline'],
      source: { type: 'Other', title: '', author: '', page: '' },
    },
    acceptableDigits: ['9', '3'],
    note: 'Personal Development (9000-9099) or Behavioral Psychology (3100)',
  },
  {
    id: 'F13', label: 'Shakespeare — to thine own self be true',
    draft: {
      title: '"To thine own self be true" — Polonius, Hamlet',
      content: 'This is often quoted as wisdom but Polonius is a fool. Shakespeare puts the most-quoted life advice in the mouth of a verbose, scheming courtier who is wrong about almost everything. The quote is dramatic irony.',
      tags: ['Shakespeare', 'Hamlet', 'irony', 'literary analysis'],
      source: { type: 'Book', title: 'Hamlet', author: 'William Shakespeare', page: '' },
    },
    acceptableDigits: ['7'],
    note: 'Literary Arts (7400)',
  },
  {
    id: 'F14', label: 'Dunning-Kruger effect',
    draft: {
      title: 'Dunning-Kruger: incompetence masks itself',
      content: 'People with low competence in a domain systematically overestimate their ability because they lack the meta-cognitive skill to recognize their own errors. As expertise grows, confidence briefly drops before rising again on a firmer foundation.',
      tags: ['Dunning-Kruger', 'metacognition', 'cognitive bias', 'self-assessment'],
      source: { type: 'Other', title: '', author: '', page: '' },
    },
    acceptableDigits: ['3'],
    note: 'Cognitive Psychology (3000-3099)',
  },
  {
    id: 'F15', label: 'Hayek on price signals vs central planning',
    draft: {
      title: 'Price as distributed knowledge: Hayek\'s critique of central planning',
      content: 'F.A. Hayek argued that prices aggregate dispersed, local knowledge that no central planner can possess. The market is not a mechanism for maximizing a known objective — it is an information system that processes millions of private signals into a single coordinated outcome.',
      tags: ['Hayek', 'price signals', 'central planning', 'market'],
      source: { type: 'Article', title: 'The Use of Knowledge in Society', author: 'F.A. Hayek', page: '' },
    },
    acceptableDigits: ['5', '6', '0'],
    note: 'Political Economy (5700), Microeconomics (6000), or Political Philosophy (0400)',
  },
  {
    id: 'F16', label: 'Darwin — natural selection mechanism',
    draft: {
      title: 'Natural selection: variation + differential reproduction',
      content: 'Darwin\'s key insight: heritable variation exists in populations; individuals with traits better suited to their environment survive and reproduce at higher rates; those traits become more common over generations. No foresight required — only differential survival.',
      tags: ['Darwin', 'evolution', 'natural selection', 'biology'],
      source: { type: 'Book', title: 'On the Origin of Species', author: 'Charles Darwin', page: '' },
    },
    acceptableDigits: ['2'],
    note: 'Biology (2200)',
  },
  {
    id: 'F17', label: 'Supply and demand — price as signal',
    draft: {
      title: 'Supply, demand, and the price mechanism',
      content: 'Price is the signal that equilibrates supply and demand without central coordination. When demand rises and supply is fixed, price rises, attracting new producers and discouraging marginal buyers. The market clears without any party seeing the full picture.',
      tags: ['supply and demand', 'price', 'microeconomics', 'markets'],
      source: { type: 'Other', title: '', author: '', page: '' },
    },
    acceptableDigits: ['6'],
    note: 'Microeconomics (6000)',
  },
  {
    id: 'F18', label: "Parkinson's Law",
    draft: {
      title: "Parkinson's Law: work expands to fill available time",
      content: 'C. Northcote Parkinson (1955): work expands to fill the time allocated to it. Corollary: tight deadlines force prioritization. Overly generous timelines breed procrastination and scope creep. The law applies to budget, committee size, and bureaucracy.',
      tags: ["Parkinson's Law", 'productivity', 'time management', 'deadline'],
      source: { type: 'Article', title: "Parkinson's Law", author: 'C. Northcote Parkinson', page: '' },
    },
    acceptableDigits: ['9', '3'],
    note: 'Time Management (9100) or Behavioral Psychology (3100)',
  },
  {
    id: 'F19', label: 'Gutenberg press — information revolution',
    draft: {
      title: 'Gutenberg press as the first mass information technology',
      content: 'The printing press (c.1440) did not just make books cheaper — it restructured power over knowledge. Literacy spread, the Church\'s monopoly on interpretation broke, the Reformation followed within 80 years. The press is the original disruptive technology.',
      tags: ['Gutenberg', 'printing press', 'Reformation', 'information technology'],
      source: { type: 'Other', title: '', author: '', page: '' },
    },
    acceptableDigits: ['1', '8'],
    note: 'Early Modern History (1300) or History of Technology (8000)',
  },
  {
    id: 'F20', label: 'The observer effect in quantum mechanics',
    draft: {
      title: 'Observer effect: measurement disturbs the quantum system',
      content: 'In quantum mechanics, measuring a property of a particle (e.g., position) disturbs its conjugate property (e.g., momentum). This is not an artifact of crude instruments — it is a fundamental feature of quantum reality described by Heisenberg\'s uncertainty principle.',
      tags: ['quantum mechanics', 'observer effect', 'Heisenberg', 'physics'],
      source: { type: 'Other', title: '', author: '', page: '' },
    },
    acceptableDigits: ['2', '0'],
    note: 'Physics (2000) or Philosophy of Science / Metaphysics',
  },
];

// ─── Filing request ───────────────────────────────────────────────────────────

async function file(fixture) {
  const res = await fetch(`${BASE_URL}/api/suggest-card-filing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draft: { address: '', ...fixture.draft },
      topLevelCategories,
      semanticHints: [],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.suggestion;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nChecking server at ${BASE_URL}...`);
  try {
    const h = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(10_000) });
    if (!h.ok) throw new Error(`HTTP ${h.status}`);
    console.log('OK\n');
  } catch (e) {
    console.error(`Server not reachable: ${e.message}`);
    process.exit(1);
  }

  console.log(`Running ${fixtures.length} card-filing fixtures against /api/suggest-card-filing...\n`);

  let passed = 0;
  let qualityPassed = 0;
  const latencies = [];
  const failures = [];

  for (const fixture of fixtures) {
    const start = Date.now();
    let suggestion, error;
    try {
      suggestion = await file(fixture);
    } catch (e) {
      error = e.message;
    }
    const ms = Date.now() - start;
    latencies.push(ms);

    const mode = suggestion?.mode;
    const confidence = suggestion?.confidence ?? 0;
    const masterRange = suggestion?.selectedMasterRange ?? '';
    const digit = masterRangeFirstDigit(masterRange);

    const modeOk = mode && mode !== 'manual_review';
    const confidenceOk = confidence >= 0.4;
    const rangeOk = fixture.acceptableDigits.includes(digit);

    const ok = !error && modeOk && confidenceOk && rangeOk;
    if (ok) passed++;

    // Quality: mode is decisive and confidence is solid
    const qualityOk = !error && modeOk && confidence >= 0.6 && rangeOk;
    if (qualityOk) qualityPassed++;

    const icon = ok ? 'PASS' : 'FAIL';
    const categoryLabel = mode === 'existing_category'
      ? suggestion?.suggestedCategoryTitle || '?'
      : mode === 'new_category'
        ? `NEW: ${suggestion?.suggestedNewCategoryTitle || '?'} under ${suggestion?.suggestedParentTitle || '?'}`
        : mode || '?';

    console.log(
      `  [${fixture.id}] ${fixture.label.padEnd(38)} ${icon} ${ms}ms | ` +
      `conf=${confidence.toFixed(2)} range=${masterRange || '?'} → ${categoryLabel}`
    );

    if (error) {
      console.log(`         ↳ error: ${error}`);
      failures.push({ fixture, reason: error });
    } else if (!modeOk) {
      console.log(`         ↳ mode=${mode} (manual_review returned for clear case)`);
      failures.push({ fixture, reason: `manual_review — ${fixture.note}` });
    } else if (!confidenceOk) {
      console.log(`         ↳ confidence too low: ${confidence.toFixed(2)}`);
      failures.push({ fixture, reason: `low confidence ${confidence.toFixed(2)}` });
    } else if (!rangeOk) {
      console.log(`         ↳ wrong master range: ${masterRange} (expected digit in [${fixture.acceptableDigits.join(',')}]) — ${fixture.note}`);
      failures.push({ fixture, reason: `wrong range ${masterRange} vs expected [${fixture.acceptableDigits.join(',')}]` });
    }
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];

  console.log('\n' + '='.repeat(60));
  console.log('FILING STRESS TEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`Pass (correct range + decisive mode):  ${passed}/${fixtures.length} (${Math.round(passed / fixtures.length * 100)}%)`);
  console.log(`Quality (confidence >= 0.6):           ${qualityPassed}/${fixtures.length} (${Math.round(qualityPassed / fixtures.length * 100)}%)`);
  console.log(`Latency p50 / p95:                     ${p50}ms / ${p95}ms`);
  if (failures.length > 0) {
    console.log(`\nFailures (${failures.length}):`);
    failures.forEach(f => console.log(`  [${f.fixture.id}] ${f.fixture.label} — ${f.reason}`));
  }
  console.log('');
}

run().catch(e => { console.error(e); process.exit(1); });
