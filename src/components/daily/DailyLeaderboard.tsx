import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Dices, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getTierEmoji, type Tier } from '@/hooks/useDailyChallenge';
import { getPlayerName, rerollPlayerName } from '@/lib/playerName';

interface BoardRow { rank: number; name: string; score: number; tier: Tier; is_me: boolean }
interface Board { total: number; me: { rank: number; score: number; beaten: number } | null; top: BoardRow[] }

interface DailyLeaderboardProps {
  date: string;
  userId: string | null;
  /** The player has a completed attempt today, so their name can be published. */
  completed: boolean;
  limit?: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

async function publishName(userId: string, date: string, name: string) {
  // Fails harmlessly if the leaderboard migration hasn't been applied yet
  await supabase
    .from('daily_challenge_attempts')
    .update({ display_name: name })
    .eq('user_id', userId)
    .eq('challenge_date', date);
}

const DailyLeaderboard = ({ date, userId, completed, limit = 10 }: DailyLeaderboardProps) => {
  const [board, setBoard] = useState<Board | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [name, setName] = useState(getPlayerName);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_daily_leaderboard', { p_date: date, p_limit: limit });
    if (error || !data) { setUnavailable(true); return; }
    setBoard(data as unknown as Board);
  }, [date, limit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (completed && userId) await publishName(userId, date, name);
      if (!cancelled) await load();
    })();
    return () => { cancelled = true; };
    // Name changes publish through reroll(), not this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, userId, date, load]);

  const reroll = async () => {
    const next = rerollPlayerName();
    setName(next);
    if (completed && userId) {
      await publishName(userId, date, next);
      await load();
    }
  };

  // No leaderboard backend yet: stay out of the way
  if (unavailable) return null;

  if (!board) {
    return (
      <div className="rounded-xl bg-black/20 p-3 space-y-1.5" aria-busy>
        {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-7 rounded-lg bg-white/5 animate-pulse" />)}
      </div>
    );
  }

  const { total, me, top } = board;
  const meInTop = top.some(r => r.is_me);
  const beatPct = me && total > 1 ? Math.round((me.beaten / (total - 1)) * 100) : null;

  return (
    <div className="rounded-xl bg-black/20 p-3 space-y-2 text-left">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-gold" /> Today's leaderboard
        </h4>
        <span className="text-xs text-muted-foreground">{total} {total === 1 ? 'player' : 'players'}</span>
      </div>

      {me && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center rounded-lg bg-primary/15 py-2"
        >
          <div className="font-display font-bold text-lg">
            #{me.rank} <span className="text-muted-foreground font-sans text-sm">of {total}</span>
          </div>
          {beatPct !== null && (
            <div className="text-xs text-muted-foreground">
              {me.rank === 1 ? "You're the top score today!" : `You beat ${beatPct}% of players`}
            </div>
          )}
        </motion.div>
      )}

      {top.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No finished boards yet. Be the first!</p>
      ) : (
        <ol className="space-y-1">
          {top.map((r, i) => (
            <motion.li
              key={`${r.rank}-${r.name}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${r.is_me ? 'bg-primary/20 ring-1 ring-primary/50' : 'bg-white/5'}`}
            >
              <span className="w-6 text-center font-display font-bold tabular-nums">{MEDALS[r.rank - 1] ?? r.rank}</span>
              <span className="flex-1 truncate">{r.name}{r.is_me && <span className="text-muted-foreground"> (you)</span>}</span>
              <span aria-hidden>{getTierEmoji(r.tier)}</span>
              <span className="font-display font-bold tabular-nums w-9 text-right">{r.score}</span>
            </motion.li>
          ))}
          {me && !meInTop && (
            <>
              <li className="text-center text-muted-foreground text-xs leading-none" aria-hidden>⋯</li>
              <li className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm bg-primary/20 ring-1 ring-primary/50">
                <span className="w-6 text-center font-display font-bold tabular-nums">{me.rank}</span>
                <span className="flex-1 truncate">{name} <span className="text-muted-foreground">(you)</span></span>
                <span className="font-display font-bold tabular-nums w-9 text-right">{me.score}</span>
              </li>
            </>
          )}
        </ol>
      )}

      {completed && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          Playing as <span className="text-foreground font-semibold">{name}</span>
          <button
            onClick={reroll}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-white/10 transition-colors"
            aria-label="Pick a new random name"
          >
            <Dices className="w-3.5 h-3.5" /> New name
          </button>
        </div>
      )}
    </div>
  );
};

export default DailyLeaderboard;
