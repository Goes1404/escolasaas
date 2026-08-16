'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus, Star, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/lib/AuthProvider';
import { useToast } from '@/hooks/use-toast';

export function FeedbackWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState('equipe_tecnica');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const CATEGORIES = [
    { value: 'equipe_tecnica', label: 'Equipe Técnica' },
    { value: 'professores', label: 'Professores' },
    { value: 'material', label: 'Material Didático' },
    { value: 'outro', label: 'Outro' },
  ];

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: 'Atenção', description: 'Por favor, selecione uma nota de 1 a 5 estrelas.', variant: 'destructive' });
      return;
    }

    if (!user) {
      toast({ title: 'Atenção', description: 'Você precisa estar logado para enviar feedback.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('system_feedbacks').insert({
        user_id: user.id,
        category,
        rating,
        comment: comment.trim() || null,
      });

      if (error) {
        throw error;
      }

      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setTimeout(() => {
          setSubmitted(false);
          setRating(0);
          setComment('');
          setCategory('equipe_tecnica');
        }, 500);
      }, 2500);

    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar o feedback. A tabela de feedbacks pode não estar configurada ainda.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-[164px] right-[30px] lg:bottom-[92px] lg:right-[30px] z-[90] h-11 w-11 bg-primary text-white rounded-full shadow-[0_10px_25px_-5px_rgba(76,204,237,0.5)] flex items-center justify-center border-2 border-white/20 glow-orange group overflow-hidden"
            aria-label="Deixe seu feedback"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <MessageSquarePlus className="h-5 w-5 relative z-10" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center sm:items-end sm:justify-end sm:p-8 pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto sm:hidden"
            />
            
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-white sm:rounded-3xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden relative z-10 border border-gray-100 sm:m-4 mt-auto rounded-t-3xl sm:rounded-b-3xl"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-5 text-white flex justify-between items-start relative overflow-hidden">
                <div className="absolute top-[-50px] right-[-50px] w-[150px] h-[150px] bg-primary/20 blur-[40px] rounded-full pointer-events-none" />
                
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-primary border border-white/5 mb-3">
                    <Star className="h-3 w-3 fill-current" /> Feedback
                  </div>
                  <h3 className="text-xl font-black italic tracking-tighter leading-tight">Nos ajude a melhorar!</h3>
                  <p className="text-xs text-white/60 font-medium mt-1">Sua opinião constrói a plataforma.</p>
                </div>
                
                <button 
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all relative z-10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 bg-gray-50 flex-1">
                {submitted ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center text-center py-6"
                  >
                    <div className="h-16 w-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-4">
                      <Send className="h-8 w-8" />
                    </div>
                    <p className="text-lg font-black text-gray-900 italic">Obrigado pelo retorno!</p>
                    <p className="text-sm text-gray-500 font-medium mt-2">Nossa equipe vai analisar com carinho.</p>
                  </motion.div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-widest text-gray-500">Para quem é o feedback?</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 focus:border-primary/50 focus:outline-none"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-widest text-gray-500">Como você avalia o portal?</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(0)}
                            className="p-1 transition-transform hover:scale-110 active:scale-95"
                          >
                            <Star
                              className={`h-8 w-8 transition-colors ${
                                star <= (hoveredRating || rating)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'fill-gray-200 text-gray-200'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-widest text-gray-500">O que podemos melhorar?</label>
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Deixe uma sugestão, crítica ou elogio para a equipe técnica e professores..."
                        className="resize-none h-28 bg-white border-gray-200 focus:border-primary/50 text-sm"
                      />
                    </div>

                    <Button 
                      onClick={handleSubmit} 
                      disabled={isSubmitting || rating === 0}
                      className="w-full h-12 rounded-xl bg-primary text-white font-black hover:bg-[#0f7a95] text-sm shadow-lg shadow-primary/20"
                    >
                      {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enviar Avaliação'}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
