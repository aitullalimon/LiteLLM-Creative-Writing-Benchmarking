import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Props = {
  children: React.ReactNode;
};

export default function AuthGate({ children }: Props) {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    if (!email) return alert("Enter your email");
    const { error } = await supabase.auth.signInWithOtp({
      email,
    });
    if (error) alert(error.message);
    else alert("Magic link sent. Check your email.");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="p-8 text-center">Loading…</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="border rounded-lg p-6 w-[360px] text-center space-y-4">
          <h2 className="text-xl font-semibold">
            Creative Writing Benchmark
          </h2>
          <p className="text-sm text-muted-foreground">
            Sign in to continue
          </p>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            onClick={signIn}
            className="w-full bg-orange-500 text-white py-2 rounded"
          >
            Send Magic Link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="absolute top-4 right-4">
        <button
          onClick={signOut}
          className="text-sm text-gray-500 underline"
        >
          Logout
        </button>
      </div>
      {children}
    </div>
  );
}
