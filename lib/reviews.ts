import type { Bank, Catalog } from './schema';
import { VERSION, SCHEMA_VERSION } from './schema';
import {
  REVIEW_DISCLAIMER,
  REVIEW_SENTIMENTS,
  REVIEW_TOPICS,
  type CustomerReview,
} from './review-model';

export function reviewCounts(reviews: CustomerReview[]) {
  return {
    total: reviews.length,
    sentiments: Object.fromEntries(
      REVIEW_SENTIMENTS.map((s) => [s, reviews.filter((r) => r.sentiment === s).length]),
    ),
    distinctPublicAuthors: new Set(
      reviews.filter((r) => r.author).map((r) => `${r.platform}:${r.author!.toLowerCase()}`),
    ).size,
    unknownAuthors: reviews.filter((r) => !r.author).length,
    conversations: new Set(reviews.map((r) => r.threadUrl ?? r.permalink)).size,
    topics: REVIEW_TOPICS.map((topic) => {
      const matching = reviews.filter((r) => r.topics.includes(topic));
      return {
        topic,
        comments: matching.length,
        distinctPublicAuthors: new Set(
          matching.filter((r) => r.author).map((r) => `${r.platform}:${r.author!.toLowerCase()}`),
        ).size,
        reviewIds: matching.map((r) => r.id),
      };
    }).filter((t) => t.comments > 0),
  };
}
export function bankReviews(bank: Bank) {
  return bank.profile?.customerReviews ?? [];
}
export function reviewReport(catalog: Catalog) {
  const all = catalog.banks.flatMap(bankReviews);
  return {
    toolVersion: VERSION,
    schemaVersion: SCHEMA_VERSION,
    catalogId: catalog.id,
    checkedOn: catalog.checkedOn,
    disclaimer: REVIEW_DISCLAIMER,
    scope:
      'Local curated evidence. No live lookup. Author handles are not authenticated people; repeated comments and shared threads are not independent confirmations. No review average or safety score is inferred.',
    coverage: {
      products: catalog.banks.length,
      productsWithComments: catalog.banks.filter((b) => bankReviews(b).length).length,
      ...reviewCounts(all),
    },
    banks: catalog.banks.map((b) => {
      const reviews = bankReviews(b);
      const ids = new Set(reviews.flatMap((r) => [...r.sourceIds, ...r.officialContext.sourceIds]));
      return {
        id: b.id,
        name: b.name,
        coverage: reviewCounts(reviews),
        reviews,
        sources: b.profile?.sources.filter((s) => ids.has(s.id)) ?? [],
        researchLog: b.profile?.researchLog.filter((r) => r.area === 'Customer reviews') ?? [],
        manualChecks: reviews.map((r) => ({ reviewId: r.id, question: r.manualCheck })),
      };
    }),
  };
}
