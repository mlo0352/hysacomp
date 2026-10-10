import { useMemo, useState } from 'react';
import type { Bank, Catalog } from '../lib/schema';
import { bankReviews, reviewCounts, reviewReport } from '../lib/reviews';
import {
  REVIEW_PLATFORMS,
  REVIEW_SENTIMENTS,
  REVIEW_TOPICS,
  type CustomerReview,
} from '../lib/review-model';
import { Sources } from './Research';
import { VerificationButton, VerificationNotebook } from './Verification';
import styles from './App.module.css';
import { DisclaimerButton } from './Disclaimer';

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replaceAll('-', ' ');
export function ReviewCard({ bank, review: r }: { bank: Bank; review: CustomerReview }) {
  return (
    <article
      className={styles.reviewCard}
      aria-label={`${bank.name}: ${r.author ?? 'Anonymous'} review`}
    >
      <div className={styles.reviewCardTop}>
        <strong>{bank.name}</strong>
        <span
          className={`${styles.reviewSentiment} ${r.sentiment === 'positive' ? styles.reviewPositive : r.sentiment === 'negative' ? styles.reviewNegative : styles.reviewMixed}`}
        >
          {title(r.sentiment)}
        </span>
      </div>
      <div className={styles.reviewByline}>
        <a href={r.permalink} target="_blank" rel="noreferrer">
          {r.author ?? 'Unknown author'} · {title(r.platform)} ↗
        </a>
        {r.rating !== null && <span>{r.rating}/5</span>}
      </div>
      <p className={styles.reviewSummary}>{r.summary}</p>
      <blockquote>
        <p>“{r.excerpt}”</p>
      </blockquote>
      <div className={styles.reviewTopics}>
        {r.topics.map((t) => (
          <span key={t}>{title(t)}</span>
        ))}
      </div>
      <div className={styles.reviewDates}>
        <span>Collected {r.accessedAt}</span>
      </div>
      <details className={styles.reviewEvidence}>
        <summary>Details & sources</summary>
        <p>{r.context}</p>
        <p>
          {r.publishedOn ? `Posted ${r.publishedOn}` : r.dateText}
          {r.experienceOn ? ` · Experience ${r.experienceOn}` : ''}
        </p>
        <p>
          <strong>Check yourself:</strong> {r.manualCheck}
        </p>
        <p>
          <strong>Official context:</strong> {r.officialContext.notes}
        </p>
        <p>
          Scope: {r.product} · {r.scope}. Resolution: {r.resolution.replaceAll('-', ' ')}.
        </p>
        {r.threadUrl && (
          <a href={r.threadUrl} target="_blank" rel="noreferrer">
            Full conversation or review listing ↗
          </a>
        )}
        {bank.profile && (
          <Sources
            profile={bank.profile}
            ids={[...new Set([...r.sourceIds, ...r.officialContext.sourceIds])].filter((id) => {
              const url = bank.profile!.sources.find((s) => s.id === id)?.url;
              return url !== r.permalink && url !== r.threadUrl;
            })}
          />
        )}
        <VerificationButton
          bank={bank}
          target={`customer-review:${r.id}`}
          label={`${r.author ?? 'Unknown author'} comment`}
        />
      </details>
    </article>
  );
}
export function BankCustomerReviews({ bank }: { bank: Bank }) {
  const reviews = bankReviews(bank);
  return (
    <details className={styles.researchSection}>
      <summary>
        Customer comments <span>{reviews.length} selected</span>
      </summary>
      <DisclaimerButton reviews />
      {!reviews.length && <p>No reviews collected yet.</p>}
      {reviews.map((r) => (
        <ReviewCard key={r.id} bank={bank} review={r} />
      ))}
    </details>
  );
}
export function ReviewsPage({ catalog }: { catalog: Catalog }) {
  const [bankId, setBank] = useState('all'),
    [sentiment, setSentiment] = useState('all'),
    [platform, setPlatform] = useState('all'),
    [topic, setTopic] = useState('all'),
    [query, setQuery] = useState('');
  const report = useMemo(() => reviewReport(catalog), [catalog]);
  const rows = catalog.banks.flatMap((bank) =>
    bankReviews(bank).map((review) => ({ bank, review })),
  );
  const filtered = rows.filter(
    ({ bank, review: r }) =>
      (bankId === 'all' || bank.id === bankId) &&
      (sentiment === 'all' || r.sentiment === sentiment) &&
      (platform === 'all' || r.platform === platform) &&
      (topic === 'all' || r.topics.includes(topic as (typeof REVIEW_TOPICS)[number])) &&
      `${bank.name} ${r.author} ${r.summary} ${r.excerpt} ${r.context}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const counts = reviewCounts(
    rows.filter(({ bank }) => bankId === 'all' || bank.id === bankId).map(({ review }) => review),
  );
  const exportReviews = () => {
    const ids = new Set(filtered.map(({ bank, review }) => `${bank.id}:${review.id}`));
    const selected = {
      ...report,
      collectionCoverage: report.coverage,
      coverage: {
        products: bankId === 'all' ? catalog.banks.length : 1,
        productsWithComments: new Set(filtered.map(({ bank }) => bank.id)).size,
        ...reviewCounts(filtered.map(({ review }) => review)),
      },
      filters: { bankId, sentiment, platform, topic, query },
      matchingComments: filtered.length,
      banks: report.banks
        .filter((b) => bankId === 'all' || b.id === bankId)
        .map((b) => {
          const reviews = b.reviews.filter((r) => ids.has(`${b.id}:${r.id}`));
          const sourceIds = new Set(
            reviews.flatMap((r) => [...r.sourceIds, ...r.officialContext.sourceIds]),
          );
          return {
            ...b,
            collectionCoverage: b.coverage,
            coverage: reviewCounts(reviews),
            reviews,
            sources: b.sources.filter((s) => sourceIds.has(s.id)),
            researchLog: b.researchLog.map((r) => ({
              ...r,
              sourceIds: r.sourceIds.filter((id) => sourceIds.has(id)),
            })),
            manualChecks: b.manualChecks.filter((c) => reviews.some((r) => r.id === c.reviewId)),
          };
        }),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-reviews.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className={styles.bankPage}>
      <div className={styles.pageHeading}>
        <div>
          <h1>Customer reviews</h1>
        </div>
        <div className={styles.actions}>
          <DisclaimerButton reviews />
          <button onClick={exportReviews}>Export reviews</button>
        </div>
      </div>
      <div className={styles.reviewFilters}>
        <label>
          Bank
          <select value={bankId} onChange={(e) => setBank(e.target.value)} aria-label="Review bank">
            <option value="all">All banks</option>
            {catalog.banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({bankReviews(b).length})
              </option>
            ))}
          </select>
        </label>
        <label>
          Experience
          <select
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value)}
            aria-label="Review sentiment"
          >
            <option value="all">All experiences</option>
            {REVIEW_SENTIMENTS.map((s) => (
              <option key={s} value={s}>
                {title(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Topic
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            aria-label="Review topic"
          >
            <option value="all">All topics</option>
            {REVIEW_TOPICS.map((s) => (
              <option key={s} value={s}>
                {title(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            aria-label="Review platform"
          >
            <option value="all">All sources</option>
            {REVIEW_PLATFORMS.map((s) => (
              <option key={s} value={s}>
                {title(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Find a comment
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search words or author…"
            aria-label="Search reviews"
          />
        </label>
      </div>
      <div className={styles.reviewCountBar}>
        <span aria-live="polite">{filtered.length} reviews</span>
      </div>
      {!filtered.length && (
        <div className={styles.reviewEmpty}>
          <strong>{counts.total ? 'No matching reviews.' : 'No reviews collected yet.'}</strong>
          <p>Try another bank or clear the filters.</p>
          <button
            onClick={() => {
              setBank('all');
              setSentiment('all');
              setPlatform('all');
              setTopic('all');
              setQuery('');
            }}
          >
            Clear review filters
          </button>
        </div>
      )}
      <div className={styles.reviewGrid}>
        {filtered.map(({ bank, review }) => (
          <ReviewCard key={`${bank.id}:${review.id}`} bank={bank} review={review} />
        ))}
      </div>
      <details className={styles.researchSection}>
        <summary>Research log</summary>
        <p>
          {report.coverage.total} comments across {report.coverage.productsWithComments} of{' '}
          {report.coverage.products} products.
        </p>
        {report.banks
          .filter((b) => bankId === 'all' || bankId === b.id)
          .map((b) => (
            <div key={b.id}>
              <strong>{b.name}</strong>
              {b.researchLog.map((r, i) => (
                <p key={i}>
                  {r.date} · {r.notes}
                </p>
              ))}
            </div>
          ))}
      </details>
      <VerificationNotebook />
    </div>
  );
}
