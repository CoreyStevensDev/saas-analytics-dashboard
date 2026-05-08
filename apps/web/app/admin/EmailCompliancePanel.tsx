import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, MailX, AlertTriangle } from 'lucide-react';
import type { EmailComplianceMetrics, ComplianceWindowCounts } from './types';

interface Props {
  metrics: EmailComplianceMetrics | null;
}

const numFmt = new Intl.NumberFormat('en-US');

// 0.3% complaint rate = Gmail/Yahoo 2024 deliverability ceiling.
const COMPLAINT_CEILING = 0.003;

function ratePct(num: number, denom: number): number | null {
  if (denom <= 0) return null;
  return num / denom;
}

function formatRate(rate: number | null, num: number, denom: number): string {
  if (rate === null) return `\u2014 (${numFmt.format(num)} of 0)`;
  return `${(rate * 100).toFixed(2)}% (${numFmt.format(num)} of ${numFmt.format(denom)})`;
}

interface WindowRowProps {
  label: string;
  counts: ComplianceWindowCounts;
  cadenceActiveUsers: number;
}

function WindowRow({ label, counts, cadenceActiveUsers }: WindowRowProps) {
  const unsubRate = ratePct(counts.unsubscribed, cadenceActiveUsers);
  const bounceRate = ratePct(counts.bounced, counts.digestsSent);
  const complaintRate = ratePct(counts.complained, counts.digestsSent);
  const complaintHigh = complaintRate !== null && complaintRate > COMPLAINT_CEILING;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unsubscribes ({label})</CardTitle>
          <MailX className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold" style={{ fontFeatureSettings: '"tnum"' }}>
            {formatRate(unsubRate, counts.unsubscribed, cadenceActiveUsers)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bounces ({label})</CardTitle>
          <MailX className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold" style={{ fontFeatureSettings: '"tnum"' }}>
            {formatRate(bounceRate, counts.bounced, counts.digestsSent)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Complaints ({label})</CardTitle>
          <AlertTriangle className={`h-4 w-4 ${complaintHigh ? 'text-destructive' : 'text-muted-foreground'}`} aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className={`text-xl font-bold ${complaintHigh ? 'text-destructive' : ''}`} style={{ fontFeatureSettings: '"tnum"' }}>
            {formatRate(complaintRate, counts.complained, counts.digestsSent)}
          </div>
          {complaintHigh && (
            <p className="mt-1 text-xs text-destructive">Above 0.3% Gmail/Yahoo ceiling</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function EmailCompliancePanel({ metrics }: Props) {
  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Email compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Metrics unavailable, the compliance endpoint returned an error or has not been configured yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { totalProUsers, cadenceActiveUsers, d7, d30, computedAt } = metrics;

  return (
    <section aria-labelledby="email-compliance-heading" className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 id="email-compliance-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Email compliance
        </h2>
        <p className="text-xs text-muted-foreground" style={{ fontFeatureSettings: '"tnum"' }}>
          {numFmt.format(totalProUsers)} Pro users, {numFmt.format(cadenceActiveUsers)} digest-active
        </p>
      </div>

      <div className="space-y-3">
        <Card className="bg-muted/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 7 days</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <WindowRow label="7d" counts={d7} cadenceActiveUsers={cadenceActiveUsers} />
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 30 days</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <WindowRow label="30d" counts={d30} cadenceActiveUsers={cadenceActiveUsers} />
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Computed {new Date(computedAt).toLocaleString()}
      </p>
    </section>
  );
}
