import type { CORSOptions } from 'graphql-yoga';

/**
 * How long a browser may reuse a CORS preflight answer, in seconds. The web app is on another
 * origin than the API, and every request it sends carries an `authorization` header, so each one
 * needs a preflight first: a full extra round trip to the server. Without this header browsers keep
 * the answer for only a few seconds (Chrome: 5). Chrome caps it at 2 hours, Firefox at 24.
 */
export const CORS_PREFLIGHT_MAX_AGE_SECONDS = 2 * 60 * 60;

/**
 * Yoga's default CORS behaviour (the caller's origin echoed back, with credentials), plus a
 * preflight that browsers may cache. A cached preflight covers one URL, which is why the web app
 * sends every operation to the same URL as a POST (`preferGetMethod: false`); both methods are
 * listed so a cached answer covers either.
 */
export const corsOptions: CORSOptions = {
  methods: ['GET', 'POST'],
  maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
};
