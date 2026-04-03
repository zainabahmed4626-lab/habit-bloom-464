import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const today = format(new Date(), 'yyyy-MM-dd');

const Dashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('date', today);
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
      queryClient.invalidateQueries({ queryKey: ['habit_logs', today] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const completedCount = todayLogs.length;
  const totalCount = habits.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (habitsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading habits...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Today's Progress</h1>
        <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>

      {/* Progress card */}
      <Card className="bg-primary text-primary-foreground border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Completed today</p>
              <p className="text-4xl font-bold mt-1">{completedCount}/{totalCount}</p>
            </div>
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" opacity="0.2" />
                <circle
                  cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - percentage / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {percentage}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Habits list */}
      <div className="space-y-3">
        {habits.map((habit) => {
          const isCompleted = todayLogs.some((l) => l.habit_id === habit.id);
          return (
            <Card
              key={habit.id}
              className={`transition-all duration-200 cursor-pointer hover:shadow-md ${
                isCompleted ? 'bg-accent border-primary/20' : 'bg-card'
              }`}
              onClick={() => toggleLog.mutate(habit.id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{habit.icon}</span>
                  <div>
                    <p className={`font-semibold ${isCompleted ? 'text-accent-foreground' : 'text-foreground'}`}>
                      {habit.name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {habit.frequency} · {habit.target_per_week}x/week
                    </p>
                  </div>
                </div>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
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
    </div>
  );
};

export default Dashboard;
