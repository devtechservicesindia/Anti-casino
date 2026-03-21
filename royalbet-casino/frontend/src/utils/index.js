// utils/index.js – shared utility helpers
// export { formatCurrency }   from './formatCurrency';
// export { formatDate }       from './formatDate';
// export { cn }               from './cn';               // clsx wrapper
// export { generateBetId }    from './generateBetId';
// export { clampBet }         from './clampBet';
// export { getRTPLabel }      from './getRTPLabel';

/**
 * Lightweight clsx wrapper. Usage:
 *   cn('base-class', condition && 'optional-class', { 'cond-class': bool })
 */
export { clsx as cn } from 'clsx';

/**
 * Format a number as INR currency string.
 * @param {number} amount
 * @returns {string} e.g. "₹1,250.00"
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}
