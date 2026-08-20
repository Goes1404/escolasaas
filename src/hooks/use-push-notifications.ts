"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/hooks/use-toast";

type PushPermissionState = "default" | "granted" | "denied" | "unsupported";

/**
 * Por que o push não está disponível neste aparelho.
 *
 * A distinção existe por causa de um número: das 68 inscrições de push da base,
 * **uma** é de iPhone, contra 55 de Android. Não é preferência dos alunos — é
 * que no iOS o Web Push só funciona com o site instalado na tela de início, e
 * antes disso o `PushManager` nem existe. O código antigo lia isso como
 * "navegador sem suporte" e escondia o banner, então o aluno de iPhone nunca
 * via absolutamente nada, nem uma instrução. Ele não recusou: nunca foi
 * convidado.
 */
export type MotivoIndisponivel = "ios_precisa_instalar" | "sem_suporte" | null;

function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+ se apresenta como Mac; o que o denuncia é a tela sensível ao toque.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

/** O site foi aberto pelo ícone da tela de início (e não pela aba do navegador). */
function ehInstalado(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Registra o Service Worker, gerencia a permissão do navegador e inscreve
 * o usuário no canal de Web Push. Persiste a inscrição no servidor.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [motivo, setMotivo] = useState<MotivoIndisponivel>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Detecta suporte e estado da permissão
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPermission("unsupported");
      // No iPhone fora da tela de início isso é temporário e tem conserto:
      // instalar o site resolve. Em qualquer outro caso é o navegador mesmo.
      setMotivo(ehIOS() && !ehInstalado() ? "ios_precisa_instalar" : "sem_suporte");
      return;
    }
    setPermission(Notification.permission as PushPermissionState);
    setMotivo(null);
  }, []);

  // Registra o SW assim que possível
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(err => {
      console.error("[push] SW register failed:", err);
    });
  }, []);

  // Verifica se já está inscrito
  useEffect(() => {
    if (permission !== "granted" || typeof window === "undefined") return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch (err) {
        console.error('[push] getSubscription check failed:', err);
      }
    })();
  }, [permission]);

  const subscribe = useCallback(async () => {
    if (!user || typeof window === "undefined") return;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      toast({ title: "Configuração pendente", description: "Notificações push ainda não foram ativadas pelo administrador.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Pede permissão se ainda não foi decidida
      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
        setPermission(perm as PushPermissionState);
      }
      if (perm === "denied") {
        toast({ title: "Permissão negada", description: "Ative as notificações nas configurações do seu navegador.", variant: "destructive" });
        setLoading(false);
        return;
      }
      if (perm !== "granted") {
        setLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (res.ok) {
        setSubscribed(true);
        toast({ title: "Notificações ativadas! 🔔", description: "Você receberá comunicados e novidades direto aqui." });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Erro ao ativar", description: data.error || "Tente novamente.", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("[push] subscribe error:", err);
      toast({ title: "Erro ao ativar notificações", description: err.message || "Verifique as permissões do navegador.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const unsubscribe = useCallback(async () => {
    if (typeof window === "undefined") return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setSubscribed(false);
      toast({ title: "Notificações desativadas" });
    } catch (err) {
      console.error("[push] unsubscribe error:", err);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { permission, motivo, subscribed, loading, subscribe, unsubscribe };
}
