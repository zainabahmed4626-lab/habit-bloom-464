import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Plus, List, LogOut, MessageCircle, FlaskConical } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/add-habit', label: 'Add Habit', icon: Plus },
  { to: '/logs', label: 'Habit Logs', icon: List },
  { to: '/chat', label: 'Coach', icon: MessageCircle },
  { to: '/insights', label: 'Insights', icon: FlaskConical },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="text-lg font-bold text-foreground">HabitFlow</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to}>
                <Button
                  variant={location.pathname === to ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-xl gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              </Link>
            ))}
          </nav>
          <Button variant="ghost" size="sm" onClick={signOut} className="rounded-xl gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log Out</span>
          </Button>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-lg">
        <div className="flex items-center justify-around h-16">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex flex-col items-center gap-1">
              <Icon className={`h-5 w-5 ${location.pathname === to ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-xs ${location.pathname === to ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      <main className="container px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
