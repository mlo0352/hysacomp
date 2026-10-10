import { useMemo, useState } from 'react';
import type { Bank, Catalog } from '../lib/schema';
import { bankReviews, reviewCounts, reviewReport } from '../lib/reviews';
import {
  REVIEW_DISCLAIMER,
  REVIEW_PLATFORMS,
  REVIEW_SENTIMENTS,
  REVIEW_TOPICS,
  type CustomerReview,
} from '../lib/review-model';
import { Sources } from './Research';
import { VerificationButton, VerificationNotebook } from './Verification';
import styles from './App.module.css';

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
        <span>{r.rating !== null ? `${r.rating}/5 by this reviewer · ` : ''}Self-reported</span>
      </div>
      <p className={styles.reviewSummary}>{r.summary}</p>
      <blockquote>
        <p>“{r.excerpt}”</p>
        <cite>
          <a href={r.permalink} target="_blank" rel="noreferrer">
            Read original comment ↗
          </a>
        </cite>
      </blockquote>
      <div className={styles.reviewTopics}>
        {r.topics.map((t) => (
          <span key={t}>{title(t)}</span>
        ))}
      </div>
      <p className={styles.reviewContext}>{r.context}</p>
      <div className={styles.reviewDates}>
        <span>
          {r.publishedOn ? `Posted ${r.publishedOn}` : `Posting date uncertain · ${r.dateText}`}
        </span>
        {r.experienceOn && <span>Experience {r.experienceOn}</span>}
        <span>Collected {r.accessedAt}</span>
        <span>
          Scope: {r.scope} · {r.product}
        </span>
      </div>
      <details className={styles.reviewEvidence}>
        <summary>What to verify & source context</summary>
        <p>
          <strong>Check yourself:</strong> {r.manualCheck}
        </p>
        <p>
          <strong>Official context · {r.officialContext.assessment.replaceAll('-', ' ')}:</strong>{' '}
          {r.officialContext.notes}
        </p>
        <p>
          Resolution: {r.resolution.replaceAll('-', ' ')}. Evidence: {r.evidence}. The described
          events have not been independently authenticated.
        </p>
        {r.threadUrl && (
          <a href={r.threadUrl} target="_blank" rel="noreferrer">
            Full conversation or review listing ↗
          </a>
        )}
        {bank.profile && (
          <Sources profile={bank.profile} ids={[...r.sourceIds, ...r.officialContext.sourceIds]} />
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
      <p>{REVIEW_DISCLAIMER}</p>
      {!reviews.length && (
        <p>
          No individual comments saved for this product yet. This is a gap in research, not a
          judgment about the bank.
        </p>
      )}
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
          <span className={styles.eyebrow}>THE PEOPLE BEHIND THE NUMBERS</span>
          <h1>Read the experiences.</h1>
          <p>Good days, frustrating days, and the details worth checking.</p>
        </div>
        <button onClick={exportReviews}>Export matching reviews</button>
      </div>
      <section className={styles.reviewIntro} aria-label="About customer reviews">
        <strong>
          {report.coverage.total} selected comments · {report.coverage.productsWithComments} of{' '}
          {report.coverage.products} products have comments
        </strong>
        <p>{REVIEW_DISCLAIMER}</p>
        <p>
          We preserve mixed experiences and source context. Counts describe this collection only.
          Missing reviews mean research is pending. Reddit ages are saved as displayed when an exact
          posting date was unavailable.
        </p>
      </section>
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
        <span aria-live="polite">{filtered.length} matching comments</span>
        <span>
          Collection for selected bank(s): {counts.sentiments.positive} positive ·{' '}
          {counts.sentiments.mixed} mixed · {counts.sentiments.negative} negative ·{' '}
          {counts.sentiments.neutral} neutral
        </span>
      </div>
      {!filtered.length && (
        <div className={styles.reviewEmpty}>
          <strong>
            {counts.total
              ? 'No comments match these filters.'
              : 'No individual comments saved for this selection yet.'}
          </strong>
          <p>
            Try another bank or broaden the filters. You can add sourced comments to a bank file
            locally; agents can follow docs/REVIEW_RESEARCH.md.
          </p>
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
        <summary>How this collection was researched</summary>
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
