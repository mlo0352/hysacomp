import { useRef } from 'react';
import { X } from 'lucide-react';
import { RESEARCH_DISCLAIMER } from '../lib/feature-model';
import { REVIEW_DISCLAIMER } from '../lib/review-model';
import styles from './App.module.css';

export function DisclaimerButton({ reviews = false }: { reviews?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className={styles.textButton}
        onClick={() => dialog.current?.showModal()}
      >
        Disclaimer
      </button>
      <dialog
        ref={dialog}
        onKeyDown={(e) => e.stopPropagation()}
        className={styles.disclaimerDialog}
        aria-label={reviews ? 'Review disclaimer' : 'Research disclaimer'}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className={styles.disclaimerHeading}>
          <h2>{reviews ? 'About these reviews' : 'About the research'}</h2>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Close disclaimer"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p>{reviews ? REVIEW_DISCLAIMER : RESEARCH_DISCLAIMER}</p>
        {reviews && (
          <p>
            Counts describe the comments collected here. Missing reviews mean research is pending. A
            personal source check does not authenticate the events described.
          </p>
        )}
      </dialog>
    </>
  );
}
