
import { useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';

export function useTimeTracker(userId: string | undefined) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Incrementar o tempo a cada 60 segundos
    const INTERVAL_SECONDS = 60;

    const tick = async () => {
      if (document.visibilityState === 'visible') {
        const { error } = await supabase.rpc('increment_time_spent', {
          p_user_id: userId,
          p_seconds: INTERVAL_SECONDS
        });
        
        if (error && error.code !== 'PGRST202') {
          console.error("Erro ao incrementar tempo:", error);
        }
      }
    };

    intervalRef.current = setInterval(tick, INTERVAL_SECONDS * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);
}
