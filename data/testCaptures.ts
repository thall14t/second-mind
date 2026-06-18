import { InboxCapture } from '../types';

const now = new Date('2026-05-01T12:00:00.000Z');

const captureAtOffset = (minutesOffset: number) => new Date(now.getTime() + minutesOffset * 60_000).toISOString();

export const testCaptures: InboxCapture[] = [
  {
    id: 'seed-capture-01',
    title: '',
    content: 'A household that automates every inconvenience can slowly lose its reasons for gratitude.',
    createdAt: captureAtOffset(0),
  },
  {
    id: 'seed-capture-02',
    title: 'Book idea',
    content: 'A school where students choose a patron vice before they choose a major.',
    createdAt: captureAtOffset(1),
  },
  {
    id: 'seed-capture-03',
    title: '',
    content: 'A city’s zoning code is a moral document disguised as geometry.',
    createdAt: captureAtOffset(2),
  },
  {
    id: 'seed-capture-04',
    title: '',
    content: 'Mix coarse salt with lemon peel in a jar to freshen a wood cutting board overnight.',
    createdAt: captureAtOffset(3),
  },
  {
    id: 'seed-capture-05',
    title: 'Article idea',
    content: 'Convenience culture treats delay as if it were injustice.',
    createdAt: captureAtOffset(4),
  },
  {
    id: 'seed-capture-06',
    title: '',
    content: 'A ritual becomes believable when it costs real time, status, or comfort.',
    createdAt: captureAtOffset(5),
  },
  {
    id: 'seed-capture-07',
    title: '',
    content: 'The most dangerous flattery is being called realistic when you are only being cynical.',
    sourceText: 'Podcast timestamp 31:42',
    createdAt: captureAtOffset(6),
  },
  {
    id: 'seed-capture-08',
    title: 'App idea',
    content: 'A reading tracker that maps which authors most changed your vocabulary over time.',
    createdAt: captureAtOffset(7),
  },
  {
    id: 'seed-capture-09',
    title: '',
    content: 'The institutions that survive scandal are usually the ones that already taught people how to interpret failure.',
    createdAt: captureAtOffset(8),
  },
  {
    id: 'seed-capture-10',
    title: '',
    content: 'Use binder clips on a desk edge to keep charging cables from sliding behind furniture.',
    createdAt: captureAtOffset(9),
  },
  {
    id: 'seed-capture-11',
    title: 'Book premise',
    content: 'An archive stores abandoned laws from dead civilizations as if they were sacred relics.',
    createdAt: captureAtOffset(10),
  },
  {
    id: 'seed-capture-12',
    title: '',
    content: 'The first sign of intellectual laziness is preferring summaries when the original text is still short.',
    createdAt: captureAtOffset(11),
  },
  {
    id: 'seed-capture-13',
    title: '',
    content: 'Warmer nights change crop outcomes even when daytime temperatures stay inside the normal band.',
    sourceText: 'https://www.noaa.gov',
    createdAt: captureAtOffset(12),
  },
  {
    id: 'seed-capture-14',
    title: '',
    content: 'A child learns reverence by watching adults handle ordinary objects with care.',
    createdAt: captureAtOffset(13),
  },
  {
    id: 'seed-capture-15',
    title: 'Sermon idea',
    content: 'Hospitality as a form of defiance against self-protective isolation.',
    createdAt: captureAtOffset(14),
  },
  {
    id: 'seed-capture-16',
    title: '',
    content: 'Nostalgia edits memory by removing the cost of old routines.',
    sourceText: 'Video essay timestamp 14:08',
    createdAt: captureAtOffset(15),
  },
  {
    id: 'seed-capture-17',
    title: '',
    content: 'Label extension cords by room rather than by device so they stay useful after furniture changes.',
    createdAt: captureAtOffset(16),
  },
  {
    id: 'seed-capture-18',
    title: '',
    content: 'The more a society speaks about empowerment, the less comfortable it often becomes with dependence.',
    createdAt: captureAtOffset(17),
  },
  {
    id: 'seed-capture-19',
    title: 'Story idea',
    content: 'A nation measures citizenship by which ancestors you can name publicly.',
    createdAt: captureAtOffset(18),
  },
  {
    id: 'seed-capture-20',
    title: '',
    content: 'A person’s inner life is less like a fortress than like a workshop that still carries the dust of its latest project.',
    createdAt: captureAtOffset(19),
  },
];

export default testCaptures;
