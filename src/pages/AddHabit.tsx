import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const ICONS = ['🏋️', '📚', '🧘', '💧', '😴', '🎯', '🏃', '🎨', '🎵', '💪', '🥗', '✍️', '🧠', '🚶', '🌅'];
const COLORS = ['#10B981', '#14B8A6', '#059669', '#0D9488', '#047857', '#0891B2', '#06B6D4', '#34D399'];

const AddHabit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [color, setColor] = useState('#10B981');
  const [frequency, setFrequency] = useState('daily');
  const [targetPerWeek, setTargetPerWeek] = useState(7);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    const { error } = await supabase.from('habits').insert({
      user_id: user!.id,
      name: name.trim(),
      icon,
      color,
      frequency,
      target_per_week: targetPerWeek,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Habit created!');
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Add New Habit</h1>

      <Card className="shadow-lg border-border/50">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Morning Jog"
                required
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIcon(i)}
                    className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                      icon === i ? 'bg-primary text-primary-foreground scale-110 shadow-md' : 'bg-muted hover:bg-accent'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-10 h-10 rounded-xl transition-all ${
                      color === c ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Frequency</label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Target / week</label>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={targetPerWeek}
                  onChange={(e) => setTargetPerWeek(Number(e.target.value))}
                  className="rounded-xl"
                />
              </div>
            </div>

            <Button type="submit" className="w-full rounded-xl" disabled={loading}>
              {loading ? 'Creating...' : 'Create Habit'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddHabit;
