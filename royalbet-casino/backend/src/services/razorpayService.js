/**
 * services/razorpayService.js
 * Wraps the Razorpay Node SDK.
 * SECURITY: HMAC-SHA256 signature verification happens here
 * before ANY database operation is performed.
 */

import Razorpay from 'razorpay';
import crypto   from 'crypto';

// ─── Singleton SDK instance ───────────────────────────────────────────────────
let _instance = null;

export function getRazorpay() {
  if (!_instance) {
    const keyId     = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env');
    }

    _instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return _instance;
}

/**
 * Create a Razorpay order.
 * Amount must be in PAISE (INR × 100).
 */
export async function createOrder({ amountInPaise, currency = 'INR', receipt }) {
  const razorpay = getRazorpay();
  const order = await razorpay.orders.create({
    amount:   amountInPaise,
    currency,
    receipt,
  });
  return order;
}

/**
 * Verify Razorpay payment signature (HMAC-SHA256).
 *
 * body to sign  = razorpayOrderId + '|' + razorpayPaymentId
 * expected      = HMAC-SHA256(RAZORPAY_KEY_SECRET, body).hex()
 * returns true if signatures match, false otherwise.
 *
 * SECURITY RULE 1: This must be called BEFORE any DB operation.
 */
export function verifySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const body     = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  const expectedBuf  = Buffer.from(expected);
  const signatureBuf = Buffer.from(razorpaySignature || '');

  // timingSafeEqual requires same-length buffers — length mismatch means invalid
  if (expectedBuf.length !== signatureBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}
