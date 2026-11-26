import type { HTTPRequest, Page } from 'puppeteer';
import type { z } from 'zod';
import type { $ZodIssue } from 'zod/v4/core';

export const LEUMI_BASE_URL = 'https://hb2.bankleumi.co.il';
export const LEUMI_HOME_URL = `${LEUMI_BASE_URL}/eBanking/SO/SPA.aspx#/hpsummary`;

const BROKER_PATH = '/ChannelWCF/Broker.svc/ProcessRequest';
/** Base of the REST API the bank's newer (React) screens use. */
export const LEUMI_MOBILE_API = '/uiapiproxy/v1/digital-retails/mobile';

/**
 * What every Leumi fetcher returns: the bank's response as it was sent, plus the outcome
 * of checking it against the schema.
 *
 * `data` is returned even when validation fails, so nothing the bank sent is lost; a
 * caller that needs the guarantee must check `isValid`. `isValid` is `null` when
 * validation was switched off.
 */
export type LeumiResult<T> = {
  data: T;
  isValid: boolean | null;
  errors: $ZodIssue[] | null;
};

export class LeumiRequestError extends Error {
  constructor(
    message: string,
    readonly details: { url: string; status?: number; bodyStart?: string },
  ) {
    super(message);
    this.name = 'LeumiRequestError';
  }
}

export function validate<TSchema extends z.ZodType>(
  schema: TSchema,
  raw: unknown,
  validateSchema: boolean,
): LeumiResult<z.infer<TSchema>> {
  if (!validateSchema) {
    return { data: raw as z.infer<TSchema>, isValid: null, errors: null };
  }
  const validation = schema.safeParse(raw);
  return {
    data: raw as z.infer<TSchema>,
    isValid: validation.success,
    errors: validation.success ? null : validation.error.issues,
  };
}

/**
 * Reads the session ID the site itself sends with every `Broker.svc` call.
 *
 * The ID is issued by the server at sign-in and the single-page app keeps it in memory
 * only, so it is taken off the wire: attach the listener, run `trigger` (something that
 * makes the app call the broker, such as loading the home page), and the first broker
 * request carries it.
 */
export async function captureSessionId(
  page: Page,
  trigger: () => Promise<unknown>,
  timeoutMs = 60_000,
): Promise<string> {
  let onRequest: ((request: HTTPRequest) => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const captured = new Promise<string>((resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          'Timed out waiting for the Leumi site to call its API; no session ID captured. The page may not be signed in.',
        ),
      );
    }, timeoutMs);

    onRequest = request => {
      if (!request.url().includes(BROKER_PATH)) return;
      const sessionId = readSessionId(request.postData());
      if (sessionId) resolve(sessionId);
    };
    page.on('request', onRequest);
  });

  try {
    const [sessionId] = await Promise.all([captured, trigger()]);
    return sessionId;
  } finally {
    if (timer) clearTimeout(timer);
    if (onRequest) page.off('request', onRequest);
  }
}

function readSessionId(postData: string | undefined): string | null {
  if (!postData) return null;
  try {
    const outer = JSON.parse(postData) as { reqObj?: unknown };
    if (typeof outer.reqObj !== 'string') return null;
    const inner = JSON.parse(outer.reqObj) as { SessionHeader?: { SessionID?: unknown } };
    const sessionId = inner.SessionHeader?.SessionID;
    return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
  } catch {
    return null;
  }
}

type InPageResponse = { status: number; contentType: string | null; text: string };

export type BrokerCall = {
  /** `UC_SO_…` / `UC_MS_…` module name. */
  module: string;
  /** The screen the site makes this call from. */
  state: string;
  params?: Record<string, unknown>;
  version?: string;
};

/**
 * Calls a module of the bank's `Broker.svc` from inside the signed-in page, the way the
 * site's own code does, and returns the decoded `jsonResp`.
 *
 * Authentication is the page's own cookies plus the captured session ID. Only `Get…`
 * modules are ever called; nothing here changes anything in the account.
 */
export async function callBroker(
  page: Page,
  sessionId: string,
  call: BrokerCall,
): Promise<unknown> {
  const url = `${LEUMI_BASE_URL}${BROKER_PATH}?moduleName=${call.module}`;
  const reqObj = {
    StateName: call.state,
    ModuleName: call.module,
    SessionHeader: { SessionID: sessionId, FIID: 'Leumi' },
    ...call.params,
  };
  const body = JSON.stringify({
    moduleName: call.module,
    reqObj: JSON.stringify(reqObj),
    version: call.version ?? 'Infra_V2.0',
  });

  const response = await page.evaluate(
    async (url, body): Promise<InPageResponse> => {
      const result = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json; charset=UTF-8', Accept: 'application/json' },
        body,
      });
      return {
        status: result.status,
        contentType: result.headers.get('content-type'),
        text: await result.text(),
      };
    },
    url,
    body,
  );

  const envelope = parseJson(response, url) as {
    ProcessRequestResult?: unknown;
    jsonResp?: unknown;
  };
  if (envelope.ProcessRequestResult !== 0 || typeof envelope.jsonResp !== 'string') {
    throw new LeumiRequestError(`Leumi ${call.module} was rejected by the broker`, {
      url,
      status: response.status,
      bodyStart: response.text.slice(0, 200),
    });
  }
  try {
    return JSON.parse(envelope.jsonResp) as unknown;
  } catch {
    throw new LeumiRequestError(`Leumi ${call.module} returned a jsonResp that is not JSON`, {
      url,
      status: response.status,
    });
  }
}

/**
 * GETs one of the bank's REST endpoints from inside the signed-in page.
 * Resolves to `null` on `204 No Content`, which is how these endpoints say "nothing here".
 */
export async function getJson(page: Page, path: string): Promise<unknown> {
  const url = `${LEUMI_BASE_URL}${path}`;
  const response = await page.evaluate(async (url): Promise<InPageResponse> => {
    const result = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return {
      status: result.status,
      contentType: result.headers.get('content-type'),
      text: await result.text(),
    };
  }, url);

  if (response.status === 204) return null;
  return parseJson(response, url);
}

function parseJson(response: InPageResponse, url: string): unknown {
  if (response.status < 200 || response.status >= 300) {
    throw new LeumiRequestError(`Leumi request failed with HTTP ${response.status}`, {
      url,
      status: response.status,
      bodyStart: response.text.slice(0, 200),
    });
  }
  try {
    return JSON.parse(response.text) as unknown;
  } catch {
    // An expired session answers with the sign-in page (HTML, status 200).
    throw new LeumiRequestError(
      'Leumi answered with something that is not JSON; the session has probably expired',
      { url, status: response.status, bodyStart: response.text.slice(0, 200) },
    );
  }
}
