import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Brain, FlaskConical, Loader2, RefreshCw, ShieldAlert, TrendingUp } from 'lucide-react';
import { z } from 'zod';

const insightSchema = z.object({
  generatedAt: z.string(),
  overallHealthScore: z.number().min(0).max(100),
  trend: z.enum(['improving', 'stable', 'declining']),
  strongestHabit: z.string(),
  atRiskHabit: z.string(),
  keyPatterns: z.array(z.string()).min(1).max(6),
  experiments: z.array(
    z.object({
      title: z.string(),
      hypothesis: z.string(),
      action: z.string(),
      successMetric: z.string(),
      durationDays: z.number().min(3).max(30),
      confidence: z.number().min(0).max(1),
    })
  ).min(1).max(3),
});

type InsightReport = z.infer<typeof insightSchema>;

const CACHE_KEY = 'habit-insights-report-v1';
const INSIGHTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/habit-insights`;

const trendTone: Record<InsightReport['trend'], string> = {
  improving: 'text-emerald-600',
  stable: 'text-amber-600',
  declining: 'text-rose-600',
};

const InsightsLab = () => {
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<InsightReport | null>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return insightSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  });

  const generatedTime = useMemo(() => {
    if (!report) return null;
    const dt = new Date(report.generatedAt);
    if (Number.isNaN(dt.getTime())) return report.generatedAt;
    return dt.toLocaleString();
  }, [report]);

  const generateReport = async () => {
    if (!session?.access_token) {
      toast.error('Please sign in again and retry.');
      return;
    }

    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const resp = await fetch(INSIGHTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed to generate insights' }));
        throw new Error(err.error || `Request failed (${resp.status})`);
      }

      const payload = insightSchema.parse(await resp.json());
      setReport(payload);
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      toast.success('Fresh insight report generated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate insights';
      const isNetworkFetchError = error instanceof TypeError && /fetch/i.test(message);
      toast.error(
        isNetworkFetchError
          ? 'Insights service unreachable. Deploy edge function "habit-insights" and retry.'
          : message
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">AI Insights Lab</h1>
          <p className="text-sm text-muted-foreground">
            Structured, evidence-driven coaching report generated from your habit logs.
          </p>
        </div>
        <Button onClick={generateReport} disabled={isLoading} className="rounded-xl gap-2">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Generate Report
            </>
          )}
        </Button>
      </div>

      {!report ? (
        <Card className="border-border/60">
          <CardContent className="p-8 text-center space-y-2">
            <Brain className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-semibold text-foreground">No report generated yet</p>
            <p className="text-sm text-muted-foreground">
              Generate your first AI report to see trend signals, risk factors, and weekly experiments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Overall Habit Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-3xl font-bold text-foreground">{report.overallHealthScore}/100</p>
                <Progress value={report.overallHealthScore} />
                <p className="text-xs text-muted-foreground">Generated {generatedTime}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Trend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className={`h-4 w-4 ${trendTone[report.trend]}`} />
                  <p className={`text-xl font-semibold capitalize ${trendTone[report.trend]}`}>{report.trend}</p>
                </div>
                <p className="text-sm text-muted-foreground">Strongest: {report.strongestHabit}</p>
                <p className="text-sm text-muted-foreground">At risk: {report.atRiskHabit}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Risk Watch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-rose-600">
                  <ShieldAlert className="h-4 w-4" />
                  <p className="font-medium">Monitor your at-risk habit this week</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Use the experiment cards below to validate what improves consistency.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Key Behavior Patterns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.keyPatterns.map((item) => (
                <div key={item} className="text-sm rounded-lg border border-border/70 bg-card px-3 py-2">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              Suggested Experiments
            </h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {report.experiments.map((experiment) => (
                <Card key={experiment.title} className="h-full">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-base">{experiment.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{experiment.durationDays} days</Badge>
                      <Badge variant="secondary">{Math.round(experiment.confidence * 100)}% confidence</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p><span className="font-medium text-foreground">Hypothesis:</span> {experiment.hypothesis}</p>
                    <p><span className="font-medium text-foreground">Action:</span> {experiment.action}</p>
                    <p><span className="font-medium text-foreground">Success metric:</span> {experiment.successMetric}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default InsightsLab;
