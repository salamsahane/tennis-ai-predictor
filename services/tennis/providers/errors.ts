export type ProviderErrorKind = 'auth' | 'rate_limit' | 'transient' | 'not_found';

export class ProviderError extends Error {
  providerId: string;
  kind: ProviderErrorKind;
  status?: number;
  retryAfterMs?: number;

  constructor(
    providerId: string,
    kind: ProviderErrorKind,
    message: string,
    status?: number,
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
    this.providerId = providerId;
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

interface AxiosLike {
  isAxiosError: true;
  response?: { status?: number; headers?: Record<string, unknown> };
}

function isAxiosLike(err: unknown): err is AxiosLike {
  return typeof err === 'object' && err !== null && (err as AxiosLike).isAxiosError === true;
}

function parseRetryAfterMs(value: unknown): number | undefined {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

// Messages are built here rather than copied from the source error, which
// can embed the request URL (and with it an API key).
export function toProviderError(providerId: string, err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;

  if (!isAxiosLike(err)) {
    return new ProviderError(providerId, 'transient', 'Unexpected provider failure');
  }

  const status = err.response?.status;
  if (status === undefined) {
    return new ProviderError(providerId, 'transient', 'No response from provider');
  }
  if (status === 401 || status === 403) {
    return new ProviderError(
      providerId,
      'auth',
      `Provider rejected credentials (${status})`,
      status,
    );
  }
  if (status === 429) {
    const retryAfterMs = parseRetryAfterMs(err.response?.headers?.['retry-after']);
    return new ProviderError(
      providerId,
      'rate_limit',
      'Provider rate limited (429)',
      status,
      retryAfterMs,
    );
  }
  if (status === 404) {
    return new ProviderError(providerId, 'not_found', 'Provider resource not found (404)', status);
  }
  return new ProviderError(providerId, 'transient', `Provider error (${status})`, status);
}

export function logProviderError(e: ProviderError): void {
  console.error('[Provider]', {
    providerId: e.providerId,
    kind: e.kind,
    status: e.status,
    message: e.message,
  });
}
