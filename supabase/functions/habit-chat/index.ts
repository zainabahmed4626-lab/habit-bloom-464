import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's habit data
    const [habitsRes, logsRes] = await Promise.all([
      supabase.from("habits").select("*").eq("user_id", user.id).order("created_at"),
      supabase
        .from("habit_logs")
        .select("*, habits(name, icon)")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(200),
    ]);

    const habits = habitsRes.data || [];
    const logs = logsRes.data || [];

    // Build context summary
    const habitSummaries = habits.map((h: any) => {
      const habitLogs = logs.filter((l: any) => l.habit_id === h.id);
      const completedCount = habitLogs.filter((l: any) => l.status === "completed").length;
      const dates = habitLogs.map((l: any) => l.date);
      const dayOfWeekCounts: Record<string, number> = {};
      for (const d of dates) {
        const day = new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
        dayOfWeekCounts[day] = (dayOfWeekCounts[day] || 0) + 1;
      }
      return {
        name: h.name,
        icon: h.icon,
        frequency: h.frequency,
        targetPerWeek: h.target_per_week,
        totalCompletions: completedCount,
        totalLogs: habitLogs.length,
        dayOfWeekBreakdown: dayOfWeekCounts,
        recentDates: dates.slice(0, 20),
      };
    });

    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `You are a personal habit coach. You have access ONLY to the user's real habit data below. Answer questions based strictly on this data — never guess or use generic advice unless you explicitly say so.

Today's date: ${today}

## User's Habits & Stats
${JSON.stringify(habitSummaries, null, 2)}

## Recent Logs (last 200, newest first)
${JSON.stringify(
  logs.slice(0, 50).map((l: any) => ({
    habit: (l.habits as any)?.name,
    date: l.date,
    status: l.status,
    notes: l.notes,
  })),
  null,
  2
)}

Guidelines:
- Reference specific numbers, dates, and habit names from the data.
- When comparing periods, compute from the dates provided.
- If data is insufficient to answer, say so honestly.
- Keep responses concise and encouraging.
- Use emoji sparingly for warmth.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("habit-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
