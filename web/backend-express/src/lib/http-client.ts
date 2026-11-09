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
    connect: { timeout: timeouts.connectMs },
    headersTimeout: timeouts.responseMs,
    bodyTimeout: timeouts.responseMs,
  });
  return agent.compose(interceptors.redirect({ maxRedirections }));
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
