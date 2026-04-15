import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Habit = {
  id: string;
  name: string;
  icon: string;
  target_per_week: number;
};

type HabitLog = {
  habit_id: string;
  date: string;
  status: string;
  notes: string | null;
};

function safeJsonExtract(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Invalid AI output format");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    const [habitsRes, logsRes] = await Promise.all([
      supabase.from("habits").select("id, name, icon, target_per_week").eq("user_id", user.id).order("created_at"),
      supabase.from("habit_logs")
        .select("habit_id, date, status, notes")
        .eq("user_id", user.id)
        .gte("date", new Date(Date.now() - 1000 * 60 * 60 * 24 * 42).toISOString().slice(0, 10))
        .order("date", { ascending: false }),
    ]);

    const habits = (habitsRes.data || []) as Habit[];
    const logs = (logsRes.data || []) as HabitLog[];

    if (habits.length === 0) {
      return new Response(
        JSON.stringify({
          generatedAt: new Date().toISOString(),
          overallHealthScore: 0,
          trend: "stable",
          strongestHabit: "No habits yet",
          atRiskHabit: "No habits yet",
          keyPatterns: ["Create your first habit to unlock AI insights."],
          experiments: [
            {
              title: "Bootstrap your first habit",
              hypothesis: "Starting with one habit improves early consistency.",
              action: "Add one daily 2-minute habit and log it for 7 days.",
              successMetric: "Complete at least 5/7 days.",
              durationDays: 7,
              confidence: 0.6,
            },
          ],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const completionsByHabit = habits.map((habit) => {
      const completed = logs.filter((l) => l.habit_id === habit.id && l.status === "completed").length;
      return {
        habit: `${habit.icon} ${habit.name}`,
        completed,
        targetPerWeek: habit.target_per_week,
      };
    });
    const totalCompleted = completionsByHabit.reduce((sum, h) => sum + h.completed, 0);
    const totalTarget = habits.reduce((sum, h) => sum + h.target_per_week * 6, 0);
    const baselineScore = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;

    const systemPrompt = `You are a senior AI habit analyst. Return strict JSON only.

Build a practical report with behavior signals and experiment design. Use the provided data only.
Do not include markdown or extra keys.

JSON schema:
{
  "generatedAt": "ISO datetime string",
  "overallHealthScore": number from 0-100,
  "trend": "improving" | "stable" | "declining",
  "strongestHabit": "string",
  "atRiskHabit": "string",
  "keyPatterns": ["1-2 sentence observation", "... up to 6"],
  "experiments": [
    {
      "title": "short name",
      "hypothesis": "testable claim",
      "action": "specific action for user",
      "successMetric": "measurable KPI",
      "durationDays": number 3-30,
      "confidence": number 0-1
    }
  ]
}

Quality bar:
- Focus on causality-like signals from dates/frequency consistency.
- Give no more than 3 experiments.
- Make experiments realistic for the next week.
- Ensure atRiskHabit is not the same as strongestHabit unless there is only one habit.

Context:
Today: ${new Date().toISOString().slice(0, 10)}
Baseline consistency score (6-week window): ${baselineScore}/100
Per-habit summary:
${JSON.stringify(completionsByHabit, null, 2)}
Recent logs:
${JSON.stringify(logs.slice(0, 200), null, 2)}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate the report now." },
        ],
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      const text = await aiResp.text().catch(() => "");
      console.error("habit-insights AI error:", status, text);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResp.json();
    const content = aiResult.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") throw new Error("Missing AI response content");

    const parsed = safeJsonExtract(content) as Record<string, unknown>;
    const responsePayload = {
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : new Date().toISOString(),
      overallHealthScore: Number(parsed.overallHealthScore ?? baselineScore),
      trend: parsed.trend === "improving" || parsed.trend === "stable" || parsed.trend === "declining" ? parsed.trend : "stable",
      strongestHabit: typeof parsed.strongestHabit === "string" ? parsed.strongestHabit : "N/A",
      atRiskHabit: typeof parsed.atRiskHabit === "string" ? parsed.atRiskHabit : "N/A",
      keyPatterns: Array.isArray(parsed.keyPatterns) ? parsed.keyPatterns.slice(0, 6) : ["Not enough data to infer patterns."],
      experiments: Array.isArray(parsed.experiments) ? parsed.experiments.slice(0, 3) : [],
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("habit-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
