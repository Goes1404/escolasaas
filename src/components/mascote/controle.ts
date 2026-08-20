/**
 * O que dá para pedir ao boneco de fora do palco.
 *
 * Vive num arquivo só para as duas implementações — o rig em SVG
 * (`Mascote3D`) e a imagem renderizada (`MascoteRenderizado`) — falarem a
 * mesma língua. É o que deixa o `Mascote` trocar uma pela outra sem que a
 * arena perceba.
 */
export interface MascoteControle {
  /**
   * Uma volta completa.
   *
   * No rig em SVG é giro de verdade, camada por camada. Na imagem renderizada
   * é uma pirueta rápida — uma foto não tem costas para mostrar.
   */
  girar360: () => void;
  fazerCarinho: () => void;
}
