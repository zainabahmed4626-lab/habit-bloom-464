import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, TrendingUp, Flame, Calendar, Volume2, Loader2, Square } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { toast } from 'sonner';

const today = format(new Date(), 'yyyy-MM-dd');
const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

const ProgressRing = ({ percent, size = 48, strokeWidth = 5, color }: { percent: number; size?: number; strokeWidth?: number; color?: string }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color || 'hsl(var(--primary))'}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.min(percent, 100) / 100)}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
        {Math.round(percent)}%
      </span>
    </div>
  );
};

const Dashboard = () => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const readSummary = useCallback(async () => {
    if (isSpeaking) { stopSpeaking(); return; }
    setSummaryLoading(true);
    setSummaryText('');
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/habit-summary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({}),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      const { summary } = await resp.json();
      setSummaryText(summary);

      const utterance = new SpeechSynthesisUtterance(summary);
      utterance.rate = 1.05;
      utterance.pitch = 1;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate summary');
    } finally {
      setSummaryLoading(false);
    }
  }, [session, isSpeaking, stopSpeaking]);

  const { data: habits = [], isLoading: habitsLoading } = useQuery({
    queryKey: ['habits'],
    queryFn: async () => {
      const { data, error } = await supabase.from('habits').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const { data: todayLogs = [] } = useQuery({
    queryKey: ['habit_logs', today],
    queryFn: async () => {
      const { data, error } = await supabase.from('habit_logs').select('*').eq('date', today);
      if (error) throw error;
      return data;
    },
  });

  const { data: weekLogs = [] } = useQuery({
    queryKey: ['habit_logs_week', weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .gte('date', weekStart)
        .lte('date', weekEnd)
        .eq('status', 'completed');
      if (error) throw error;
      return data;
    },
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ['recent_habit_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*, habits(name, icon)')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const toggleLog = useMutation({
    mutationFn: async (habitId: string) => {
      const existing = todayLogs.find((l) => l.habit_id === habitId);
      if (existing) {
        const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('habit_logs').insert({
          habit_id: habitId,
          user_id: user!.id,
          date: today,
          status: 'completed',
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habit_logs'] });
      queryClient.invalidateQueries({ queryKey: ['recent_habit_logs'] });
      queryClient.invalidateQueries({ queryKey: ['habit_logs_week'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const weekCompletions = weekLogs.length;

  if (habitsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading habits...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {/* Weekly big number */}
      <Card className="bg-primary text-primary-foreground border-0 shadow-lg">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-foreground/15 flex items-center justify-center">
            <Flame className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm opacity-80">This Week</p>
            <p className="text-4xl font-extrabold mt-0.5">{weekCompletions} <span className="text-lg font-semibold opacity-80">Completions</span></p>
          </div>
        </CardContent>
      </Card>

      {/* Read My Summary */}
      <div className="space-y-3">
        <Button
          onClick={readSummary}
          disabled={summaryLoading}
          variant={isSpeaking ? 'destructive' : 'outline'}
          className="w-full rounded-xl gap-2 h-12 text-base"
        >
          {summaryLoading ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Generating summary...</>
          ) : isSpeaking ? (
            <><Square className="h-4 w-4" /> Stop Reading</>
          ) : (
            <><Volume2 className="h-5 w-5" /> Read My Summary</>
          )}
        </Button>
        {summaryText && (
          <Card className="bg-card border-border/50">
            <CardContent className="p-4 text-sm text-foreground leading-relaxed">
              {summaryText}
            </CardContent>
          </Card>
        )}
      </div>


      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Weekly Progress</h2>
        <div className="grid gap-3">
          {habits.map((habit) => {
            const habitWeekLogs = weekLogs.filter((l) => l.habit_id === habit.id).length;
            const percent = habit.target_per_week > 0 ? (habitWeekLogs / habit.target_per_week) * 100 : 0;
            const isCompletedToday = todayLogs.some((l) => l.habit_id === habit.id);

            return (
              <Card
                key={habit.id}
                className={`transition-all duration-200 cursor-pointer hover:shadow-md ${
                  isCompletedToday ? 'bg-accent border-primary/20' : 'bg-card'
                }`}
                onClick={() => toggleLog.mutate(habit.id)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <ProgressRing percent={percent} color={habit.color} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${isCompletedToday ? 'text-accent-foreground' : 'text-foreground'}`}>
                      {habit.icon} {habit.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {habitWeekLogs}/{habit.target_per_week} this week
                    </p>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                      isCompletedToday ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompletedToday ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {habits.length === 0 && (
            <Card className="bg-card">
              <CardContent className="p-8 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No habits yet. Add your first one!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Recent logs */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        {recentLogs.length === 0 ? (
          <Card className="bg-card">
            <CardContent className="p-8 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Start by completing your first habit today.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <Card key={log.id} className="bg-card">
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="text-xl">{(log.habits as any)?.icon || '✅'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{(log.habits as any)?.name || 'Habit'}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(log.date + 'T00:00:00'), 'MMM d, yyyy')}</p>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-accent text-accent-foreground shrink-0">
                    {log.status === 'completed' ? '✓ Done' : 'Missed'}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
