import { z } from 'zod';

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + 'T00:00:00Z');
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === s;
  }, 'Invalid date');
const url = z
  .string()
  .url()
  .refine((s) => /^https?:\/\//i.test(s));
export const REVIEW_TOPICS = [
  'access',
  'transfers',
  'holds',
  'support',
  'app',
  'onboarding',
  'rates-fees',
  'closure',
  'security',
  'features',
] as const;
export const REVIEW_SENTIMENTS = ['positive', 'mixed', 'negative', 'neutral'] as const;
export const REVIEW_PLATFORMS = [
  'reddit',
  'yelp',
  'trustpilot',
  'app-store',
  'forum',
  'other',
] as const;
export const REVIEW_DISCLAIMER =
  'Selected public comments, not a representative survey or a bank safety score. Experiences are self-reported and may be incomplete, outdated or incorrect. Check the original conversation and current bank terms. A personal source check does not authenticate the events described. Reviews never change the earnings ranking.';

export function reviewIdentity(link: string) {
  let u: URL;
  try {
    u = new URL(link);
  } catch {
    return `invalid:${link}`;
  } // Field validation reports malformed URLs without throwing from safeParse.
  const host = u.hostname.toLowerCase().replace(/^(www\.|old\.|new\.)/, '');
  const reddit =
    u.pathname.match(/\/comment\/([a-z0-9]+)/i) ??
    u.pathname.match(/\/comments\/[^/]+\/[^/]+\/([a-z0-9]+)/i);
  if (host === 'reddit.com' && reddit) return `reddit:${reddit[1].toLowerCase()}`;
  // Keep functional query IDs and comment anchors used by app stores and forums.
  // Yelp's hrid identifies a review independently of pagination or highlight options.
  if (/(^|\.)yelp\.com$/.test(host) && u.searchParams.has('hrid'))
    return `${host}:review:${u.searchParams.get('hrid')}`;
  for (const key of [...u.searchParams.keys()])
    if (/^utm_|^(fbclid|gclid|msclkid)$/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  const query = u.searchParams.toString();
  return `${host}${u.pathname.replace(/\/+$/, '')}${query ? `?${query}` : ''}${u.hash}`;
}

export const CustomerReviewSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]+$/),
    platform: z.enum(REVIEW_PLATFORMS),
    author: z.string().min(1).max(150).nullable(),
    permalink: url,
    threadUrl: url.nullable(),
    sourceIds: z.array(z.string()).min(1),
    publishedOn: day.nullable(),
    dateText: z.string().min(1).max(250),
    accessedAt: day,
    experienceOn: day.nullable(),
    product: z.string().min(1).max(250),
    scope: z.enum(['product', 'linked-product', 'institution', 'unclear']),
    sentiment: z.enum(REVIEW_SENTIMENTS),
    topics: z.array(z.enum(REVIEW_TOPICS)).min(1),
    excerpt: z.string().min(1).max(1600),
    summary: z.string().min(1).max(1600),
    context: z.string().min(1).max(1600),
    evidence: z.enum(['firsthand', 'secondhand', 'unclear']),
    status: z.literal('reported'),
    rating: z.number().min(0).max(5).nullable(),
    resolution: z.enum(['reported-resolved', 'reported-unresolved', 'unknown']),
    manualCheck: z.string().min(1).max(1600),
    officialContext: z
      .object({
        assessment: z.enum([
          'not-checked',
          'no-published-rule',
          'related-policy',
          'conflicting-policy',
        ]),
        notes: z.string().min(1).max(1600),
        sourceIds: z.array(z.string()),
      })
      .strict(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (
      (r.publishedOn && r.publishedOn > r.accessedAt) ||
      (r.experienceOn && r.experienceOn > r.accessedAt)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Review publication/experience cannot follow access date.',
      });
    if (
      r.platform === 'reddit' &&
      (!reviewIdentity(r.permalink).startsWith('reddit:') || r.rating !== null)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Reddit needs an individual comment permalink; votes are not star ratings.',
      });
    if (r.officialContext.assessment !== 'not-checked' && !r.officialContext.sourceIds.length)
      ctx.addIssue({ code: 'custom', message: 'Policy context needs its own official sources.' });
    if (new Set(r.topics).size !== r.topics.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate review topics.' });
  });
export type CustomerReview = z.infer<typeof CustomerReviewSchema>;
