"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { fixEncoding } from "@/lib/utils";
import { Loader2, Sparkles, Wrench, TrendingUp, ImageIcon, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type UpdateEntry = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  tag: "feature" | "improvement" | "bugfix";
  created_at: string;
  link_url: string | null;
  link_label: string | null;
};

const TAG_META: Record<UpdateEntry["tag"], { label: string; className: string; icon: any }> = {
  feature: { label: "Novidade", className: "bg-primary/10 text-primary border-primary/20", icon: Sparkles },
  improvement: { label: "Melhoria", className: "bg-blue-50 text-blue-600 border-blue-200", icon: TrendingUp },
  bugfix: { label: "Correção", className: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: Wrench },
};

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<UpdateEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("product_updates")
        .select("id, title, description, image_url, tag, created_at, link_url, link_label")
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (active) {
        if (!error && data) setUpdates(data as UpdateEntry[]);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10 animate-in fade-in duration-500">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-orange-500 to-amber-500 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-black italic text-xl md:text-2xl tracking-tighter leading-tight">Novidades</h1>
            <p className="text-white/80 text-xs md:text-sm font-medium">
              Tudo que mudou e o que chegou de novo na plataforma
            </p>
          </div>
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : updates.length === 0 ? (
        <div className="text-center py-16 px-4">
          <Sparkles className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold text-sm">Nenhuma novidade publicada ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {updates.map((entry) => {
            const meta = TAG_META[entry.tag] ?? TAG_META.feature;
            const TagIcon = meta.icon;
            return (
              <article
                key={entry.id}
                className="bg-white rounded-[1.75rem] border border-slate-100 shadow-sm overflow-hidden"
              >
                {entry.image_url ? (
                  <div className="relative w-full h-44 bg-slate-100">
                    <Image
                      src={entry.image_url}
                      alt={fixEncoding(entry.title)}
                      fill
                      sizes="(max-width: 768px) 100vw, 672px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-20 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-slate-300" />
                  </div>
                )}

                <div className="p-5 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${meta.className}`}>
                      <TagIcon className="h-3 w-3" />
                      {meta.label}
                    </span>
                    <time className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "long", year: "numeric",
                      })}
                    </time>
                  </div>

                  <h2 className="font-black text-slate-900 text-base leading-snug break-words">
                    {fixEncoding(entry.title)}
                  </h2>
                  <p className="text-slate-600 text-sm leading-relaxed break-words">
                    {fixEncoding(entry.description)}
                  </p>

                  {entry.link_url && (
                    <Link
                      href={entry.link_url}
                      className="inline-flex items-center gap-1.5 mt-1 text-xs font-black uppercase tracking-wide text-primary hover:gap-2.5 transition-all"
                    >
                      {entry.link_label ? fixEncoding(entry.link_label) : "Ver agora"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
