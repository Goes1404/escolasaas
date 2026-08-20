# Arte do bichinho

Coloque aqui a arte renderizada de cada arquétipo. O app procura por
`/<arquetipo>.webp` e passa a usar a imagem no lugar do desenho vetorial —
não há nada para registrar, configurar ou reiniciar: **existir o arquivo é o
contrato**. Tirar o arquivo faz o vetor voltar sozinho.

| Arquivo | Arquétipo |
|---------|-----------|
| `lobinho.webp` | Lobinho |
| `dragao.webp` | Dragão |
| `dinossauro.webp` | Dinossauro |
| `eletrico.webp` | Elétrico |
| `capivara.webp` · `coruja.webp` · `gato.webp` · `tucano.webp` | Os quatro clássicos (opcionais) |

Enquanto um arquivo não existir, aquele bicho aparece em vetor. Dá para fazer
um de cada vez — não precisa ter os oito para começar.

## Requisitos da imagem

1. **Fundo transparente.** É o requisito que não dá para negociar. A arena
   desenha o próprio céu, chão e bokeh, e troca a iluminação conforme o humor
   do bicho (sol, fim de tarde, noite). Por cima disso o boneco pula, se
   inclina quando o aluno arrasta o dedo e dá pirueta. Uma imagem com cenário
   embutido pularia junto com o cenário, e o sistema de humor viraria enfeite
   morto.
2. **Sem sombra projetada.** A sombra no chão é desenhada pelo app e acompanha
   o pulo e a inclinação. Uma sombra colada na imagem se moveria junto com o
   bicho, que é exatamente o que sombra não faz.
3. **Corpo inteiro, centralizado, patas encostando na borda de baixo.** O app
   apoia o bicho pelo pé; sobra em baixo faz ele flutuar.
4. **Quadrada** (1:1), sugestão de 1024×1024.
5. **WebP**, de preferência abaixo de 150 KB. O alvo é o celular do aluno em
   rede móvel — os oito arquivos somados são o que ele vai baixar.

> Se a ferramenta que você usar só exportar PNG, converta antes de commitar.
> Um PNG de 2 MB por bicho é o tipo de coisa que só dói no aluno com internet
> ruim, que é justamente quem a plataforma não pode perder.

## Se o gerador devolver o quadriculado desenhado

Pedir "fundo transparente" costuma devolver o **quadriculado de transparência
desenhado como pixels**, sem canal alfa nenhum. Foi o que aconteceu com o
lobinho. Nesse caso não regere: rode

```bash
node scripts/recortar-mascote.mjs ~/Downloads/lobinho.png lobinho
```

Ele recorta o xadrez, apara a margem, apoia o bicho pelas patas, redimensiona
para 1024×1024 e grava direto em `public/mascotes/lobinho.webp`.

O script recusa a imagem em vez de gravar arquivo ruim quando quase nada foi
recortado (não havia xadrez) ou quando quase tudo foi (o recorte comeu o bicho).

**Confira o resultado antes de commitar.** Onde o bicho é branco e felpudo e
encosta num quadro branco, o recorte apara algumas pontas de pelo — no lobinho
isso aconteceu na cauda, e ficou imperceptível na escala da arena. Se o seu
bicho for muito claro, vale olhar.

Se o fundo vier chapado (branco liso, sem xadrez), este script não serve — me
avise que eu trato esse caso.

## Prompts

Gerados pela própria engine (`promptDeImagem` em `src/lib/mascote.ts`) — é a
mesma função que alimenta o campo `image_gen_prompt` da especificação. Servem
para Midjourney, DALL·E, Flux ou equivalente.

Estes são os prompts do estado neutro (bicho olhando para a câmera, luz de
sol). São eles que valem para o arquivo, porque **o arquivo é por arquétipo,
não por aluno** — humor e nível continuam sendo expressos pela arena, pela
barra de HP e pelas animações, que valem para os oito bichos igualmente.

### Lobinho — `public/mascotes/lobinho.webp`

```
3D rendered Pixar-style character render of a fluffy grey husky wolf pup with bright blue eyes, alert pointed ears and a huge curled fluffy tail, wearing a blue bandana, looking straight at the camera, curious and expectant, warm midday sunlight from above, soft dappled highlights, soft global illumination, subsurface scattering, chunky stylized proportions, big expressive eyes, mobile game creature, full body, centered, feet at the bottom edge, isolated cutout on a fully transparent background, no background, no scenery, no ground, no cast shadow, no text, no watermark, --ar 1:1 --style raw
```

### Dragão — `public/mascotes/dragao.webp`

```
3D rendered Pixar-style character render of a chubby baby dragon with soft violet scales, small rounded horns, tiny bat wings on its back and a warm ember glow, wearing a blue bandana, looking straight at the camera, curious and expectant, warm midday sunlight from above, soft dappled highlights, soft global illumination, subsurface scattering, chunky stylized proportions, big expressive eyes, mobile game creature, full body, centered, feet at the bottom edge, isolated cutout on a fully transparent background, no background, no scenery, no ground, no cast shadow, no text, no watermark, --ar 1:1 --style raw
```

### Dinossauro — `public/mascotes/dinossauro.webp`

```
3D rendered Pixar-style character render of a chubby baby T-Rex with rubbery mint green skin, a pale yellow belly, big round eyes and small rounded teeth, wearing a blue bandana, looking straight at the camera, curious and expectant, warm midday sunlight from above, soft dappled highlights, soft global illumination, subsurface scattering, chunky stylized proportions, big expressive eyes, mobile game creature, full body, centered, feet at the bottom edge, isolated cutout on a fully transparent background, no background, no scenery, no ground, no cast shadow, no text, no watermark, --ar 1:1 --style raw
```

### Elétrico — `public/mascotes/eletrico.webp`

```
3D rendered Pixar-style character render of a small yellow electric rodent creature with long black-tipped ears, glowing red cheeks and a lightning-bolt tail crackling with sparks, wearing a blue bandana, looking straight at the camera, curious and expectant, warm midday sunlight from above, soft dappled highlights, soft global illumination, subsurface scattering, chunky stylized proportions, big expressive eyes, mobile game creature, full body, centered, feet at the bottom edge, isolated cutout on a fully transparent background, no background, no scenery, no ground, no cast shadow, no text, no watermark, --ar 1:1 --style raw
```

### Capivara — `public/mascotes/capivara.webp`

```
3D rendered Pixar-style character render of a chubby friendly capybara with warm brown fur, tiny round ears and a calm smile, wearing a blue bandana, looking straight at the camera, curious and expectant, warm midday sunlight from above, soft dappled highlights, soft global illumination, subsurface scattering, chunky stylized proportions, big expressive eyes, mobile game creature, full body, centered, feet at the bottom edge, isolated cutout on a fully transparent background, no background, no scenery, no ground, no cast shadow, no text, no watermark, --ar 1:1 --style raw
```

### Coruja — `public/mascotes/coruja.webp`

```
3D rendered Pixar-style character render of a round fluffy owlet with huge amber eyes, feather tufts and a small orange beak, wearing a blue bandana, looking straight at the camera, curious and expectant, warm midday sunlight from above, soft dappled highlights, soft global illumination, subsurface scattering, chunky stylized proportions, big expressive eyes, mobile game creature, full body, centered, feet at the bottom edge, isolated cutout on a fully transparent background, no background, no scenery, no ground, no cast shadow, no text, no watermark, --ar 1:1 --style raw
```

### Gato — `public/mascotes/gato.webp`

```
3D rendered Pixar-style character render of a small orange tabby kitten with pointed ears, green eyes and a thin curved tail, wearing a blue bandana, looking straight at the camera, curious and expectant, warm midday sunlight from above, soft dappled highlights, soft global illumination, subsurface scattering, chunky stylized proportions, big expressive eyes, mobile game creature, full body, centered, feet at the bottom edge, isolated cutout on a fully transparent background, no background, no scenery, no ground, no cast shadow, no text, no watermark, --ar 1:1 --style raw
```

### Tucano — `public/mascotes/tucano.webp`

```
3D rendered Pixar-style character render of a cartoon toucan chick with glossy black feathers, a cream chest and an oversized bright yellow beak, wearing a blue bandana, looking straight at the camera, curious and expectant, warm midday sunlight from above, soft dappled highlights, soft global illumination, subsurface scattering, chunky stylized proportions, big expressive eyes, mobile game creature, full body, centered, feet at the bottom edge, isolated cutout on a fully transparent background, no background, no scenery, no ground, no cast shadow, no text, no watermark, --ar 1:1 --style raw
```

