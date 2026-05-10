import { proxyGet } from '@/lib/bff-proxy';

// no-store on the upstream; freshness matters for the dashboard indicator
// (you want "just now" to flip the moment a digest sends).
export const GET = proxyGet('/digest/last-sent');
