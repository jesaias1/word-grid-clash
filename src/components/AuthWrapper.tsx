
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthWrapperProps {
  children: React.ReactNode;
  allowGuest?: boolean;
  onGuestLogin?: () => void;
}

const AuthWrapper = ({ children, allowGuest = false, onGuestLogin }: AuthWrapperProps) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check current session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null);
        
        // Create profile if signing up
        if (event === 'SIGNED_UP' as any && session?.user && username) {
          try {
            const { error } = await supabase
              .from('profiles')
              .insert([
                {
                  id: session.user.id,
                  username: username
                }
              ]);
            
            if (error) throw error;
          } catch (error) {
            console.error('Error creating profile:', error);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [username]);

  const signIn = async () => {
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "Successfully signed in",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const signUp = async () => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username",
        variant: "destructive"
      });
      return;
    }

    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Account created!",
        description: "Check your email to verify your account",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    if (isGuest) {
      setIsGuest(false);
      setUser(null);
      toast({
        title: "Guest session ended",
        description: "See you next time!",
      });
    } else {
      await supabase.auth.signOut();
      toast({
        title: "Signed out",
        description: "See you next time!",
      });
    }
  };

  const handleGuestLogin = () => {
    setIsGuest(true);
    setUser({ id: 'guest', email: 'guest@lettus.game' });
    toast({
      title: "Guest mode",
      description: "Playing as guest - limited features available",
    });
    onGuestLogin?.();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 bg-gradient-card">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              LETTUS
            </h1>
            <p className="text-muted-foreground">Sign in to play multiplayer</p>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
              <Button 
                onClick={signIn} 
                disabled={authLoading || !email || !password}
                className="w-full"
              >
                {authLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                />
              </div>
              <Button 
                onClick={signUp} 
                disabled={authLoading || !email || !password || !username}
                className="w-full"
              >
                {authLoading ? 'Creating account...' : 'Sign Up'}
              </Button>
            </TabsContent>
          </Tabs>

          {allowGuest && (
            <div className="mt-6 pt-4 border-t border-border">
              <Button 
                onClick={handleGuestLogin}
                variant="outline"
                className="w-full"
              >
                Continue as Guest
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Limited features - no online multiplayer
              </p>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="absolute top-4 right-4">
        <Button onClick={signOut} variant="outline" size="sm">
          {isGuest ? 'Exit Guest Mode' : 'Sign Out'}
        </Button>
      </div>
      {children}
    </div>
  );
};

export default AuthWrapper;
