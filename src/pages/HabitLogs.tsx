import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { Calendar, FileText } from 'lucide-react';

const HabitLogs = () => {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['all_habit_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*, habits(name, icon, color)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading logs...</div>
      </div>
    );
  }

  // Group logs by date
  const grouped = logs.reduce<Record<string, typeof logs>>((acc, log) => {
    const date = log.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Habit Logs</h1>
        <p className="text-muted-foreground">Your recent activity</p>
      </div>

      {Object.keys(grouped).length === 0 && (
        <Card className="bg-card">
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No logs yet. Complete a habit to see it here!</p>
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([date, dateLogs]) => (
        <div key={date} className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(new Date(date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
          </div>
          <div className="space-y-2">
            {dateLogs.map((log) => (
              <Card key={log.id} className="bg-card hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <span className="text-2xl">{(log.habits as any)?.icon || '✅'}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{(log.habits as any)?.name || 'Habit'}</p>
                    {log.notes && (
                      <p className="text-sm text-muted-foreground">{log.notes}</p>
                    )}
                  </div>
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-accent text-accent-foreground">
                    {log.status === 'completed' ? '✓ Done' : 'Missed'}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default HabitLogs;
