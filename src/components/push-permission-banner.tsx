"use client";

import { useState, useEffect } from "react";
import { Bell, X, Loader2, Share, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { trackAcao } from "@/lib/telemetry";

const DISMISS_KEY = "app_push_dismissed_at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
/** Marca que o estado desta visita já virou telemetria. */
const MEDIDO_KEY = "app_push_medido";

type Modo = "pedir" | "ios_instalar" | "bloqueado" | null;

/**
 * Convite para ativar as notificações.
 *
 * Reescrito em 12/08 depois de olhar de quem são as 68 inscrições da base:
 * **55 Android, 16 Windows, 1 iPhone**. O iPhone não estava recusando — no iOS
 * o Web Push só existe com o site instalado na tela de início, e até lá o
 * `PushManager` nem aparece. A versão anterior lia isso como "navegador sem
 * suporte" e devolvia `null`: o aluno de iPhone não via convite, não via
 * instrução, não via nada. Mesmo destino tinha quem já havia bloqueado uma vez
 * — sumia para sempre, sem caminho de volta.
 *
 * Agora cada um desses casos tem uma tela com o próximo passo possível.
 */
export function PushPermissionBanner() {
  const { permission, motivo, subscribed, loading, subscribe } = usePushNotifications();
  const [dispensado, setDispensado] = useState(true);
  const [vapidPronto, setVapidPronto] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVapidPronto(!!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    const ultimo = Number(localStorage.getItem(DISMISS_KEY) || 0);
    setDispensado(Date.now() - ultimo < DISMISS_TTL_MS);
  }, []);

  // Mede o funil uma vez por visita. Até aqui só se sabia quem CONSEGUIU se
  // inscrever; quem não conseguia era invisível, e por isso a barreira do iOS
  // passou meses sem aparecer em lugar nenhum.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(MEDIDO_KEY)) return;
      sessionStorage.setItem(MEDIDO_KEY, "1");
      trackAcao("push_estado", {
        permissao: permission,
        motivo: motivo ?? "nenhum",
        inscrito: subscribed,
      });
    } catch {
      // storage bloqueado: seguir sem medir é melhor que quebrar a tela
    }
  }, [permission, motivo, subscribed]);

  function dispensar(modo: Modo) {
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    trackAcao("push_dispensado", { modo: modo ?? "desconhecido" });
    setDispensado(true);
  }

  async function ativar() {
    trackAcao("push_ativar_tocado");
    await subscribe();
  }

  const modo: Modo =
    permission === "granted" && subscribed ? null
    : motivo === "ios_precisa_instalar" ? "ios_instalar"
    : permission === "unsupported" ? null           // navegador que não tem como
    : permission === "denied" ? "bloqueado"
    : "pedir";

  if (!vapidPronto || modo === null || dispensado) return null;

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-40 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-primary text-white rounded-card shadow-2xl p-5 border border-white/10">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-accent text-accent-foreground flex items-center justify-center shrink-0">
            {modo === "ios_instalar" ? <Share className="h-5 w-5" />
              : modo === "bloqueado" ? <Settings className="h-5 w-5" />
              : <Bell className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            {modo === "pedir" && (
              <>
                <p className="font-black text-sm italic leading-tight">Não perca sua ofensiva</p>
                {/* A promessa é concreta e é a que o aluno vive: um aviso por
                    dia, no fim da tarde, quando ainda dá tempo de estudar. */}
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  Um aviso por dia, às 18h, se você ainda não tiver estudado. Só isso.
                </p>
              </>
            )}
            {modo === "ios_instalar" && (
              <>
                <p className="font-black text-sm italic leading-tight">Instale para receber avisos</p>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  No iPhone, as notificações só funcionam com o app na tela de início.
                </p>
              </>
            )}
            {modo === "bloqueado" && (
              <>
                <p className="font-black text-sm italic leading-tight">Notificações bloqueadas</p>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  Você bloqueou os avisos neste navegador. Dá para liberar de novo.
                </p>
              </>
            )}
          </div>
          <button
            onClick={() => dispensar(modo)}
            aria-label="Dispensar"
            className="h-11 w-11 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors shrink-0 -mr-1 -mt-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Instruções: no iOS e no bloqueio não há botão que resolva — o
            caminho é fora da página, então o que cabe aqui é ensinar. */}
        {modo === "ios_instalar" && (
          <ol className="mt-4 space-y-2 text-xs text-white/85 font-medium">
            <li className="flex items-start gap-2">
              <span className="font-black text-accent shrink-0">1.</span>
              <span>Toque em <Share className="h-3.5 w-3.5 inline align-text-bottom" /> <b>Compartilhar</b>, na barra do Safari.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-black text-accent shrink-0">2.</span>
              <span>Escolha <Plus className="h-3.5 w-3.5 inline align-text-bottom" /> <b>Adicionar à Tela de Início</b>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-black text-accent shrink-0">3.</span>
              <span>Abra o app <b>pelo ícone novo</b> e ative os avisos por lá.</span>
            </li>
          </ol>
        )}

        {modo === "bloqueado" && (
          <p className="mt-4 text-xs text-white/85 font-medium leading-relaxed">
            Toque no <b>cadeado</b> (ou no ícone ao lado do endereço), abra as permissões do
            site e mude <b>Notificações</b> para <b>Permitir</b>. Depois recarregue a página.
          </p>
        )}

        <div className="flex gap-3 mt-4">
          {modo === "pedir" && (
            <Button
              onClick={ativar}
              disabled={loading}
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 border-none font-black text-sm rounded-2xl h-12 active:scale-95 transition-all"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
              Ativar
            </Button>
          )}
          <Button
            onClick={() => dispensar(modo)}
            variant="ghost"
            className="flex-1 text-white/70 hover:text-white hover:bg-white/10 font-bold text-sm rounded-2xl h-12 active:scale-95 transition-all"
          >
            {modo === "pedir" ? "Agora não" : "Entendi"}
          </Button>
        </div>
      </div>
    </div>
  );
}
