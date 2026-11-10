import { lookup, type LookupAddress, type LookupOptions } from 'node:dns';
import { Agent, interceptors, request, type Dispatcher } from 'undici';

export interface HttpClientTimeouts {
  readonly connectMs: number;
  readonly responseMs: number;
}

/**
 * Dispatcher with explicit connect and response timeouts (replaces OkHttp timeouts). Redirects
 * are followed, as OkHttp does by default.
 */
export function createDispatcher(timeouts: HttpClientTimeouts, maxRedirections = 10): Dispatcher {
  const agent = new Agent({
    connect: { timeout: timeouts.connectMs, lookup: lookupIpv6First },
    headersTimeout: timeouts.responseMs,
    bodyTimeout: timeouts.responseMs,
  });
  return agent.compose(interceptors.redirect({ maxRedirections }));
}

/**
 * DNS lookup that lists IPv6 addresses first, so connections try IPv6 and fall back to IPv4 only
 * when IPv6 does not connect (as browsers do). Some hosts are much slower over IPv4: the
 * japaneseasmr.com image CDN takes 7–12 s per reply over IPv4 against 0.4 s over IPv6, which made
 * covers hang when many loaded at once.
 */
function lookupIpv6First(
  hostname: string,
  options: LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family: number) => void,
): void {
  lookup(hostname, { ...options, order: 'ipv6first' }, callback);
}

export interface HttpCall {
  readonly url: URL | string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly headers?: Record<string, string>;
  readonly body?: string;
  readonly signal?: AbortSignal;
}

export type HttpResult = Dispatcher.ResponseData;

/**
 * Performs one HTTP call. Network failures (connect, reset, timeout) throw. HTTP error statuses
 * are returned to the caller, which decides what they mean.
 */
export function httpCall(dispatcher: Dispatcher, call: HttpCall): Promise<HttpResult> {
  return request(call.url, {
    method: call.method,
    headers: call.headers,
    body: call.body,
    signal: call.signal,
    dispatcher,
  });
}
