/**
 * seed-special-simulado.ts
 *
 * Script para cadastrar o Simulado Especial dos Professores no Supabase.
 * Cadastra o exame, as 45 questões com gabarito e parâmetros TRI calibrados.
 *
 * Executar com:
 *   npx tsx scripts/seed-special-simulado.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Questões extraídas do PDF "Simulado Online - Prof. Helio" (Ciências da Natureza & Matemática)
// Gabarito e dificuldade fornecidos pelo usuário
const GABARITO_RAW = [
  {
    numero: 1, resposta: "A", dificuldade: "Fácil",
    enunciado: "(ENEM 2024) A luminância de um objeto é a grandeza que descreve a quantidade de luz produzida ou refletida por sua superfície. Ela está definida como a razão entre a intensidade luminosa, medida em candela (cd), e o quadrado da distância do objeto até o foco de luz, medida em metro (m). A unidade de medida da luminância de um objeto é:",
    opcoes: { A: "cd/m²", B: "m²/cd", C: "cd/m", D: "m/cd", E: "m/cd²" }
  },
  {
    numero: 2, resposta: "E", dificuldade: "Difícil",
    enunciado: "(ENEM 2024) A resistência de um fio de platina pode ser usada para medir temperaturas entre 0 °C e 100 °C e já foi utilizada como referência para a escala internacional de temperatura. Para um sensor feito de platina, a relação entre a resistência e a temperatura pode ser descrita por uma equação do tipo R(T) = A + BT, em que T é a temperatura e A e B são constantes. O gráfico apresenta a dependência da resistência em função da temperatura para cinco diferentes sensores. [IMAGEM_PENDENTE: gráfico Resistência (ohm) x Temperatura (°C) com 5 sensores] Considerando o comportamento linear descrito, quais sensores atendem ao modelo de relação entre resistência e temperatura descrito no texto?",
    opcoes: { A: "1 e 2", B: "1 e 3", C: "2 e 3", D: "2 e 4", E: "2 e 5" }
  },
  {
    numero: 3, resposta: "D", dificuldade: "Médio",
    enunciado: "(ENEM PPL 2024) A transferência de calor por radiação pode ser observada realizando-se a experiência de colocar a mesma quantidade de água quente em dois copos metálicos com as mesmas características, sendo que a superfície externa de um deles é pintada de preto (copo 1), e a do outro é espelhada (copo 2). Sabe-se que todo material emite e absorve energia radiante e que bons emissores são também bons absorvedores dessa energia. [IMAGEM_PENDENTE: ilustração dos dois copos, 1 preto e 2 espelhado] Ao se colocar um termômetro dentro de cada copo observa-se, após alguns minutos, que a temperatura da água:",
    opcoes: {
      A: "dos dois copos diminui igualmente.",
      B: "do copo 1 diminui, e a do copo 2 permanece a mesma.",
      C: "do copo 2 diminui, e a do copo 1 permanece a mesma.",
      D: "do copo 1 diminui mais rapidamente do que a do copo 2.",
      E: "do copo 2 diminui mais rapidamente do que a do copo 1."
    }
  },
  {
    numero: 4, resposta: "A", dificuldade: "Médio",
    enunciado: "(ENEM 2024) A tirinha ilustra esquimós dentro de um iglu, habitação de formato hemisférico construída durante o inverno a partir de neve ou blocos de gelo. Essa estrutura de construção se justifica pelo fato de esse povo habitar as regiões mais setentrionais da Groenlândia, Canadá e Alasca. [IMAGEM_PENDENTE: tirinha - esquimós comprando geladeira para fazer gelo dentro do iglu] Na tirinha, a geladeira é necessária para fazer gelo porque:",
    opcoes: {
      A: "a temperatura interna do iglu é maior que a de solidificação da água.",
      B: "a umidade dentro do iglu dificulta o processo de mudança de fase da água.",
      C: "o ar dentro do iglu é isolante térmico, dificultando a perda de calor pela água.",
      D: "a temperatura uniforme no interior do iglu impede as correntes de convecção.",
      E: "a pressão do ar no interior do iglu é baixa, dificultando a solidificação da água."
    }
  },
  {
    numero: 5, resposta: "C", dificuldade: "Fácil",
    enunciado: "(ENEM 2021) Um fabricante de termômetros orienta em seu manual de instruções que o instrumento deve ficar três minutos em contato com o corpo para aferir a temperatura. Esses termômetros são feitos com o bulbo preenchido com mercúrio conectado a um tubo capilar de vidro. De acordo com a termodinâmica, esse procedimento se justifica, pois é necessário que:",
    opcoes: {
      A: "o termômetro e o corpo tenham a mesma energia interna.",
      B: "a temperatura do corpo passe para o termômetro.",
      C: "o equilíbrio térmico entre os corpos seja atingido.",
      D: "a quantidade de calor dos corpos seja a mesma.",
      E: "o calor do termômetro passe para o corpo."
    }
  },
  {
    numero: 6, resposta: "C", dificuldade: "Médio",
    enunciado: "(ENEM 2023) Um professor lança uma esfera verticalmente para cima, a qual retorna, depois de alguns segundos, ao ponto de lançamento. Em seguida, lista em um quadro todas as possibilidades para as grandezas cinemáticas (velocidade e aceleração, com módulo nulo ou não nulo, e sentido para cima, para baixo ou indefinido quando o módulo é nulo). Ele solicita aos alunos que analisem as grandezas cinemáticas no instante em que a esfera atinge a altura máxima, escolhendo uma combinação para os módulos e sentidos da velocidade e da aceleração. A escolha que corresponde à combinação correta é:",
    opcoes: {
      A: "v = 0 e a ≠ 0 para cima.",
      B: "v ≠ 0 para cima e a = 0.",
      C: "v = 0 e a ≠ 0 para baixo.",
      D: "v ≠ 0 para cima e a ≠ 0 para cima.",
      E: "v ≠ 0 para baixo e a ≠ 0 para baixo."
    }
  },
  {
    numero: 7, resposta: "D", dificuldade: "Fácil",
    enunciado: "(ENEM PPL 2023) Um menino está ajudando sua mãe na cozinha. Ela lhe pede que tire do fogo uma panela que já estava lá há bastante tempo, em fogo baixo, orientando-lhe que tome cuidado para não se queimar, buscando tocar apenas no cabo de madeira, e não na base de metal da panela. A mãe lhe fez essa recomendação porque o metal, em relação à madeira, apresenta maior:",
    opcoes: {
      A: "calor específico.",
      B: "energia interna.",
      C: "temperatura.",
      D: "condutividade térmica.",
      E: "coeficiente de dilatação térmica."
    }
  },
  {
    numero: 8, resposta: "D", dificuldade: "Médio",
    enunciado: "(ENEM 2023) Em uma indústria alimentícia, para produção de doce de leite, utiliza-se um tacho de parede oca com uma entrada para vapor de água a 120 °C e uma saída para água líquida em equilíbrio com o vapor a 100 °C. Ao passar pela parte oca do tacho, o vapor de água transforma-se em líquido, liberando energia. A parede transfere essa energia para o interior do tacho, resultando na evaporação de água e consequente concentração do produto. No processo de concentração do produto, é utilizada energia proveniente:",
    opcoes: {
      A: "somente do calor latente de vaporização.",
      B: "somente do calor latente de condensação.",
      C: "do calor sensível e do calor latente de vaporização.",
      D: "do calor sensível e do calor latente de condensação.",
      E: "do calor latente de condensação e do calor latente de vaporização."
    }
  },
  {
    numero: 9, resposta: "E", dificuldade: "Fácil",
    enunciado: "(ENEM 2021) Os materiais são classificados pela sua natureza química e estrutural, e as diferentes aplicações requerem características específicas, como a condutibilidade térmica, quando são utilizados, por exemplo, em utensílios de cozinha. Assim, os alimentos são acondicionados em recipientes que podem manter a temperatura após o preparo. Considere a tabela, que apresenta a condutibilidade térmica (K, em kcal·h⁻¹·m⁻¹·°C⁻¹) de diferentes materiais utilizados na confecção de panelas: I - Cobre (332,0); II - Alumínio (175,0); III - Ferro (40,0); IV - Vidro (0,65); V - Cerâmica (0,40). Qual dos materiais é o recomendado para manter um alimento aquecido por um maior intervalo de tempo?",
    opcoes: { A: "I", B: "II", C: "III", D: "IV", E: "V" }
  },
  {
    numero: 10, resposta: "D", dificuldade: "Fácil",
    enunciado: "(ENEM 2025) Existe um processo de purificação de água em que são removidos os sais dissolvidos. A água que passa por esse processo é muito utilizada em laboratórios de química, em indústrias (como solvente), em baterias de carros etc. Entretanto, esse tipo de água não é adequado para ingestão, pois pode causar problemas de saúde, como carência iônica e diarreia. Essa água é chamada de:",
    opcoes: { A: "dura.", B: "pesada.", C: "sanitária.", D: "destilada.", E: "oxigenada." }
  },
  {
    numero: 11, resposta: "E", dificuldade: "Difícil",
    enunciado: "(ENEM 2025) O Brasil é o maior produtor mundial de nióbio (massa molar = 93 g/mol), metal utilizado na fabricação de vários tipos de aço: automotivos, estruturais e inoxidáveis. O processo utilizado na produção do nióbio é a redução aluminotérmica de Nb2O5 com excesso de 10% de Al (massa molar = 27 g/mol), em relação à quantidade estequiométrica da reação, representada pela equação química: 3 Nb2O5 (s) + 10 Al (s) → 6 Nb (s) + 5 Al2O3 (s). Uma engenheira metalúrgica estimou a massa de alumínio necessária para produzir 9,3 kg de nióbio, nas condições descritas, para a produção de um lote de peças de aço encomendado por uma indústria, considerando um rendimento de 100%. A massa de alumínio, em quilograma, estimada pela engenheira é mais próxima de:",
    opcoes: { A: "2,7 kg.", B: "3,0 kg.", C: "4,1 kg.", D: "4,5 kg.", E: "5,0 kg." }
  },
  {
    numero: 12, resposta: "B", dificuldade: "Difícil",
    enunciado: "(ENEM 2025) Apaixonada por culinária e química, uma chefe de cozinha calculou que, para promover o crescimento adequado da massa durante o cozimento de um bolo a 180 °C (453 K) e 1,00 atm, ela precisaria utilizar uma quantidade de fermento químico suficiente para produzir um volume de gás igual a 4,00 L. Com esse objetivo, ela escolheu utilizar o bicarbonato de amônio, um composto que, sob aquecimento, degrada-se em três gases distintos, que são os responsáveis pelo crescimento da massa. A decomposição do bicarbonato de amônio ocorre conforme a equação química: NH4HCO3 (s) → NH3 (g) + CO2 (g) + H2O (g), e, nas condições do cozimento, seu rendimento é de 80%. Dados: Massa molar do NH4HCO3 = 79 g/mol e R = 0,082 atm·L/mol·K. Considere que a mistura dos gases se comporta como gás ideal nas condições de cozimento utilizadas pela chefe. A massa, em grama, de bicarbonato de amônio que ela deve utilizar é mais próxima de:",
    opcoes: { A: "2,3 g.", B: "3,5 g.", C: "5,9 g.", D: "6,8 g.", E: "8,9 g." }
  },
  {
    numero: 13, resposta: "C", dificuldade: "Difícil",
    enunciado: "(ENEM 2024) O biogás é uma alternativa energética muito importante, pois, além de reduzir a dependência por combustíveis fósseis, sua obtenção pode ser realizada a partir de resíduos da produção agroindustrial. Considere que o biogás produzido em um empreendimento de suinocultura contém 70% em volume de metano (massa molar 16 g/mol; volume molar 22 L/mol). Ele será utilizado para geração de energia em substituição ao etanol (massa molar 46 g/mol) em um gerador no qual 1 m³ de biogás de origem suína substitui 0,59 L de etanol anidro (densidade 0,78 g/mL). Nessas condições, a massa de metano necessária para substituir 10 mol de etanol na produção de energia é mais próxima de:",
    opcoes: { A: "300 g.", B: "400 g.", C: "510 g.", D: "590 g.", E: "720 g." }
  },
  {
    numero: 14, resposta: "D", dificuldade: "Fácil",
    enunciado: "(ENEM 2024) A bauxita contém alumina (Al2O3), que é a matéria-prima para produção do alumínio (Al). De forma geral, são necessários 50 kg de bauxita para produzir 10 kg de alumínio. O Brasil fechou 2020 como um dos principais líderes mundiais em reciclagem de latas de alumínio. De acordo com levantamento da Associação Brasileira dos Fabricantes de Latas de Alumínio (Abralatas), o país obteve um índice de reciclagem de 97,4%, de um total de 4,0 × 10⁵ toneladas de latas vendidas. Considere que a lata é constituída de alumínio puro. Levando em conta apenas a reciclagem de latas, qual é o valor mais próximo da massa de bauxita, em tonelada, que deixou de ser extraída da natureza em 2020 no Brasil?",
    opcoes: { A: "1,0 × 10⁴ ton", B: "3,9 × 10⁵ ton", C: "5,0 × 10⁵ ton", D: "1,9 × 10⁶ ton", E: "2,0 × 10⁷ ton" }
  },
  {
    numero: 15, resposta: "A", dificuldade: "Médio",
    enunciado: "(ENEM 2024) O magnésio metálico utilizado em ligas leves é produzido em um processo que envolve várias etapas e utiliza água do mar como matéria-prima. A primeira etapa desse processo consiste na reação entre o íon Mg2+ e hidróxido de cálcio, Ca(OH)2, obtendo uma mistura que contém hidróxido de magnésio, pouco solúvel, e íons Ca2+, de acordo com a equação química: Mg2+(aq) + Ca(OH)2 (aq) → Mg(OH)2 (s) + Ca2+(aq). O método adequado para separar o Mg(OH)2 dessa mistura é a:",
    opcoes: { A: "filtração.", B: "catação.", C: "destilação.", D: "dissolução.", E: "evaporação." }
  },
  {
    numero: 16, resposta: "C", dificuldade: "Difícil",
    enunciado: "(ENEM 2023) De acordo com a Constituição Federal, é competência dos municípios o gerenciamento dos serviços de limpeza e coleta dos resíduos urbanos (lixo). No entanto, há relatos de que parte desse lixo acaba sendo incinerado, liberando substâncias tóxicas para o ambiente e causando acidentes por explosões, principalmente quando ocorre a incineração de frascos de aerossóis (por exemplo: desodorantes, inseticidas e repelentes). A temperatura elevada provoca a vaporização de todo o conteúdo dentro desse tipo de frasco, aumentando a pressão em seu interior até culminar na explosão da embalagem. Suponha um frasco metálico de um aerossol de capacidade igual a 100 mL, contendo 0,1 mol de produtos gasosos à temperatura de 650 °C, no momento da explosão. R = 0,082 L·atm/mol·K. Considere: A pressão, em atm, dentro do frasco, no momento da explosão, é mais próxima de:",
    opcoes: { A: "756.", B: "533.", C: "76.", D: "53.", E: "13." }
  },
  {
    numero: 17, resposta: "A", dificuldade: "Fácil",
    enunciado: "(ENEM 2023) O consumo exagerado de refrigerantes é preocupante, pois contribui para o aumento de casos de obesidade e diabetes. Considere dois refrigerantes enlatados, um comum e um diet, e que ambos possuam a mesma quantidade de aditivos, exceto pela presença de açúcar. O refrigerante comum contém basicamente água carbonatada e grande quantidade de açúcar; já o refrigerante diet tem água carbonatada e adoçantes, cujas massas são muito pequenas. Entre as duas versões apresentadas, o refrigerante comum possui:",
    opcoes: {
      A: "maior densidade.",
      B: "menor viscosidade.",
      C: "maior volume de gás dissolvido.",
      D: "menor massa de solutos dissolvidos.",
      E: "maior temperatura de congelamento."
    }
  },
  {
    numero: 18, resposta: "D", dificuldade: "Difícil",
    enunciado: "(ENEM 2023) Existe no comércio um produto antimofo constituído por uma embalagem com tampa perfurada contendo cloreto de cálcio anidro, CaCl2. Uma vez aberto o lacre, essa substância absorve a umidade ambiente, transformando-se em cloreto de cálcio di-hidratado, CaCl2·2H2O. Considere a massa molar da água igual a 18 g/mol, e a massa molar do cloreto de cálcio anidro igual a 111 g/mol. Na hidratação da substância presente no antimofo, o ganho percentual, em massa, é mais próximo de:",
    opcoes: { A: "14%", B: "16%", C: "24%", D: "32%", E: "75%" }
  },
  {
    numero: 19, resposta: "D", dificuldade: "Médio",
    enunciado: "(ENEM 2022) O urânio é empregado como fonte de energia em reatores nucleares. Para tanto, o seu mineral deve ser refinado, convertido a hexafluoreto de urânio e posteriormente enriquecido, para aumentar de 0,7% a 3% a abundância de um isótopo específico — o urânio-235. Uma das formas de enriquecimento utiliza a pequena diferença de massa entre os hexafluoretos de urânio-235 e de urânio-238 para separá-los por efusão, precedida pela vaporização. Esses vapores devem efundir repetidamente milhares de vezes através de barreiras porosas formadas por telas com grande número de pequenos orifícios. No entanto, devido à complexidade e à grande quantidade de energia envolvida, cientistas e engenheiros continuam a pesquisar procedimentos alternativos de enriquecimento. Considerando a diferença de massa mencionada entre os dois isótopos, que tipo de procedimento alternativo ao da efusão pode ser empregado para tal finalidade?",
    opcoes: {
      A: "Peneiração.",
      B: "Centrifugação.",
      C: "Extração por solvente.",
      D: "Destilação fracionada.",
      E: "Separação magnética."
    }
  },
  {
    numero: 20, resposta: "C", dificuldade: "Difícil",
    enunciado: "A obtenção de etanol utilizando a cana-de-açúcar envolve a fermentação dos monossacarídeos formadores da sacarose contida no melaço. Um desses formadores é a glicose (C6H12O6), cuja fermentação produz cerca de 50 g de etanol a partir de 100 g de glicose, conforme a equação química: C6H12O6 → 2 CH3CH2OH + 2 CO2. Em uma condição específica de fermentação, obtém-se 80% de conversão em etanol que, após sua purificação, apresenta densidade igual a 0,80 g/mL. O melaço utilizado apresentou 50 kg de monossacarídeos na forma de glicose. O volume de etanol, em litro, obtido nesse processo é mais próximo de:",
    opcoes: { A: "16.", B: "20.", C: "25.", D: "64.", E: "100." }
  },
  {
    numero: 21, resposta: "B", dificuldade: "Difícil",
    enunciado: "(ENEM 2019) O experimento clássico de Miller e Urey testou a hipótese de Oparin e Haldane sobre a origem da vida. Nesse experimento, a formação de moléculas orgânicas a partir de uma mistura de gases simples foi possível devido à simulação de:",
    opcoes: {
      A: "radiação ultravioleta.",
      B: "descargas elétricas.",
      C: "intensa fotossíntese.",
      D: "resfriamento global.",
      E: "vulcanismo ativo."
    }
  },
  {
    numero: 22, resposta: "C", dificuldade: "Fácil",
    enunciado: "(ENEM 2018) A mitocôndria é uma organela fundamental para o metabolismo celular. [IMAGEM_PENDENTE: diagrama Anatomia da Célula Animal] Qual é a principal função atribuída a essa estrutura nas células eucariontes?",
    opcoes: {
      A: "Síntese de proteínas.",
      B: "Digestão de partículas ingeridas.",
      C: "Produção de energia (ATP) por respiração aeróbica.",
      D: "Armazenamento de material genético.",
      E: "Produção de lípideos."
    }
  },
  {
    numero: 23, resposta: "C", dificuldade: "Difícil",
    enunciado: "(ENEM 2017) Em um heredograma, um indivíduo apresenta uma característica genética recessiva. [IMAGEM_PENDENTE: heredograma com legenda lobo da orelha solto/preso] Para que esse fenótipo seja expresso, é necessário que o indivíduo seja:",
    opcoes: {
      A: "homozigoto dominante.",
      B: "heterozigoto.",
      C: "homozigoto recessivo.",
      D: "portador de mutação somática.",
      E: "do sexo feminino."
    }
  },
  {
    numero: 24, resposta: "D", dificuldade: "Médio",
    enunciado: "(ENEM 2016) A teoria de Lamarck foi fundamental para a história da evolução. O conceito de \"uso e desuso\" sugere que:",
    opcoes: {
      A: "as mutações ocorrem para favorecer o indivíduo.",
      B: "as estruturas que não são usadas atrofiam e desaparecem.",
      C: "a seleção natural atua sobre a variabilidade genética.",
      D: "as características adquiridas são herdadas pelos descendentes.",
      E: "a sobrevivência é determinada pelo acaso."
    }
  },
  {
    numero: 25, resposta: "C", dificuldade: "Médio",
    enunciado: "(ENEM 2021) O núcleo celular é considerado o centro de comando da célula. Qual das estruturas abaixo é responsável pela síntese dos componentes dos ribossomos?",
    opcoes: { A: "Carioteca.", B: "Cromatina.", C: "Nucléolo.", D: "Nucleoplasma.", E: "Poro nuclear." }
  },
  {
    numero: 26, resposta: "B", dificuldade: "Médio",
    enunciado: "(ENEM 2017) Uma proteína é sintetizada e, em seguida, secretada pela célula. [IMAGEM_PENDENTE: diagrama transcrição/tradução no núcleo e citoplasma] Qual o trajeto correto das organelas envolvidas nesse processo?",
    opcoes: {
      A: "Ribossomos → Lisossomos → Membrana.",
      B: "Retículo Endoplasmático Rugoso → Complexo de Golgi → Vesículas de secreção.",
      C: "Mitocôndria → Retículo Endoplasmático Liso → Complexo de Golgi.",
      D: "Núcleo → Retículo Endoplasmático Liso → Membrana.",
      E: "Complexo de Golgi → Ribossomos → Vesículas."
    }
  },
  {
    numero: 27, resposta: "C", dificuldade: "Médio",
    enunciado: "(ENEM 2019) No ciclo celular, a fase S (Síntese) é caracterizada pela duplicação do DNA. [IMAGEM_PENDENTE: gráfico Quantidade de DNA x fases do ciclo celular G1,S,G2,P,M,A,T,G1] Se uma célula em G1 possui 2n cromossomos e uma quantidade X de DNA, ao final da fase S, teremos:",
    opcoes: {
      A: "2n cromossomos e X de DNA.",
      B: "4n cromossomos e 2X de DNA.",
      C: "2n cromossomos e 2X de DNA.",
      D: "n cromossomos e X de DNA.",
      E: "4n cromossomos e X de DNA."
    }
  },
  {
    numero: 28, resposta: "A", dificuldade: "Difícil",
    enunciado: "(ENEM 2021) A variabilidade genética na meiose é aumentada pelo fenômeno de crossing-over. [IMAGEM_PENDENTE: diagrama das fases da meiose II] Em que momento da meiose esse fenômeno ocorre?",
    opcoes: { A: "Prófase I.", B: "Metáfase I.", C: "Anáfase I.", D: "Prófase II.", E: "Metáfase II." }
  },
  {
    numero: 29, resposta: "B", dificuldade: "Fácil",
    enunciado: "(ENEM 2023) A evolução convergente é um fenômeno onde espécies distantes apresentam características semelhantes devido a pressões ambientais parecidas. Um exemplo clássico seria:",
    opcoes: {
      A: "asas de morcego e braços humanos.",
      B: "nadadeiras de golfinho e barbatanas de tubarão.",
      C: "braços humanos e patas de cavalo.",
      D: "asas de ave e asas de inseto (estrutura análoga).",
      E: "penas de ave e escamas de réptil."
    }
  },
  {
    numero: 30, resposta: "E", dificuldade: "Fácil",
    enunciado: "(ENEM 2016) Uma mulher daltônica casa-se com um homem de visão normal. [IMAGEM_PENDENTE: legenda genética - mulher heterozigota, mulher não daltônica, mulher daltônica, homem não daltônico, homem daltônico] Qual a probabilidade de terem um filho (sexo masculino) daltônico?",
    opcoes: { A: "0%.", B: "25%.", C: "50%.", D: "75%.", E: "100%." }
  },
  {
    numero: 31, resposta: "B", dificuldade: "Fácil",
    enunciado: "(ENEM 2024) Ao calcular a média de suas notas em 4 provas, um estudante dividiu, por engano, a soma das notas por 5. Com isso, a média obtida foi 1 unidade menor do que deveria ser, caso fosse calculada corretamente. O valor correto da média das notas desse estudante é:",
    opcoes: { A: "4.", B: "5.", C: "6.", D: "19.", E: "21." }
  },
  {
    numero: 32, resposta: "A", dificuldade: "Fácil",
    enunciado: "(ENEM 2024) Um artesão utiliza dois tipos de componentes, X e Y, nos enfeites que produz. Ele sempre compra todos os componentes em uma mesma loja. Preços dos componentes: Loja I — X: R$ 3,00, Y: R$ 1,00; Loja II — X: R$ 2,00, Y: R$ 4,00. Ele confeccionará enfeites formados por duas unidades do componente X e uma unidade do componente Y e efetuará a compra na loja que oferecer o menor valor total para a confecção de um enfeite. O artesão efetuará a compra na loja:",
    opcoes: {
      A: "I, pois o valor é R$ 7,00.",
      B: "I, pois o valor é R$ 4,00.",
      C: "II, pois o valor é R$ 6,00.",
      D: "I, pois anuncia o componente com o menor preço.",
      E: "II, pois o componente X, que é o mais utilizado, tem menor preço."
    }
  },
  {
    numero: 33, resposta: "B", dificuldade: "Médio",
    enunciado: "(ENEM 2024) Três grandezas (I, II e III) se relacionam entre si. [IMAGEM_PENDENTE: gráficos formados por segmentos de reta relacionando grandeza I com II, e II com III] Os gráficos descrevem as relações de dependência existentes entre as grandezas I e II, e entre as grandezas II e III. O valor máximo assumido pela grandeza III, quando a grandeza I varia de 1 a 3, é:",
    opcoes: { A: "1,0.", B: "2,5.", C: "3,0.", D: "3,5.", E: "4,0." }
  },
  {
    numero: 34, resposta: "B", dificuldade: "Médio",
    enunciado: "(ENEM 2024) Um fazendeiro pretende construir um galinheiro ocupando uma região plana de formato retangular, com lados de comprimentos L metro e C metro. Os lados serão cercados por telas de tipos diferentes. Nos lados de comprimento L metro, será utilizada uma tela cujo metro linear custa R$ 20,00, enquanto, nos outros dois lados, uma que custa R$ 15,00. O fazendeiro quer gastar, no máximo, R$ 6.000,00 na compra de toda a tela necessária para o galinheiro, e deseja que o galinheiro tenha a maior área possível. Qual será a medida, em metro, do maior lado do galinheiro?",
    opcoes: { A: "85", B: "100", C: "175", D: "200", E: "350" }
  },
  {
    numero: 35, resposta: "D", dificuldade: "Fácil",
    enunciado: "(ENEM 2024) O estádio do Maracanã passou por algumas modificações estruturais para a realização da Copa do Mundo de 2014, como, por exemplo, as dimensões do campo retangular. Para se adaptar aos padrões da Fifa, as dimensões do campo foram reduzidas de 110 m x 75 m para 105 m x 68 m. Em quantos metros quadrados a área do campo do Maracanã foi reduzida?",
    opcoes: { A: "24", B: "35", C: "555", D: "1110", E: "1145" }
  },
  {
    numero: 36, resposta: "D", dificuldade: "Fácil",
    enunciado: "(ENEM 2024) Um instituto de pesquisa constatou que, nos últimos dez anos, o crescimento populacional de uma cidade foi de 135,25%. Qual é a representação decimal da taxa percentual desse crescimento populacional?",
    opcoes: { A: "13525,0", B: "135,25", C: "13,525", D: "1,3525", E: "0,13525" }
  },
  {
    numero: 37, resposta: "C", dificuldade: "Fácil",
    enunciado: "(ENEM 2024) Contratos de vários serviços disponíveis na internet apresentam uma quantidade excessiva de informações. Isso faz com que o tempo necessário para a leitura desses contratos possa ser longo. Tempo necessário para leitura completa do contrato (em minuto), por tipo de serviço: A: 36, B: 17, C: 27, D: 13, E: 13, F: 13. O tempo médio, em minuto, necessário para a leitura completa de um contrato de serviço dentre os listados é, com uma casa decimal, aproximadamente:",
    opcoes: { A: "13,0.", B: "15,0.", C: "19,8.", D: "20,0.", E: "23,3." }
  },
  {
    numero: 38, resposta: "C", dificuldade: "Médio",
    enunciado: "(ENEM 2024) Uma doceira vende e entrega, em seu bairro, porções de 100 g de docinhos de aniversário. Atualmente, a taxa única de entrega é R$ 10,00, e o valor cobrado por uma porção é R$ 25,00. Por uma estratégia de vendas, a partir da próxima semana, a taxa única de entrega será R$ 15,00, e um novo valor será cobrado por uma porção, de maneira que o valor total a ser pago por um cliente na compra de 5 porções permaneça o mesmo. A partir da próxima semana, qual será o novo valor cobrado, em real, por uma porção?",
    opcoes: { A: "R$ 12,50", B: "R$ 20,00", C: "R$ 24,00", D: "R$ 30,00", E: "R$ 37,50" }
  },
  {
    numero: 39, resposta: "C", dificuldade: "Médio",
    enunciado: "(ENEM 2024) Uma tubulação despeja sempre o mesmo volume de água por unidade de tempo em uma caixa-d'água, o que significa dizer que a vazão de água nessa tubulação é constante. Na junção dessa tubulação com a caixa-d'água, está instalada uma membrana de filtragem cujo objetivo é filtrar eventuais impurezas presentes na água, combinado a um bom fluxo de água. O fluxo (φ) de água através da superfície da membrana é diretamente proporcional à vazão de água na tubulação, medida em mililitro por segundo, e inversamente proporcional à área da superfície da membrana, medida em centímetro quadrado. A unidade de medida adequada para descrever o fluxo (φ) de água que atravessa a superfície da membrana é:",
    opcoes: { A: "mL·s·cm²", B: "mL/(s·cm²)", C: "mL/(cm²·s)", D: "cm²·s/mL", E: "cm²/(mL·s)" }
  },
  {
    numero: 40, resposta: "D", dificuldade: "Fácil",
    enunciado: "(ENEM 2024) Para obter um sólido de revolução (rotação de 360° em torno de um eixo fixo), uma professora realizou as seguintes etapas: recortou o trapézio retângulo PQRS de um material rígido; afixou o lado PS do trapézio em uma vareta fixa retilínea (eixo de rotação); girou o trapézio 360° em torno da vareta e obteve um sólido de revolução. [IMAGEM_PENDENTE: figura do trapézio retângulo PQRS afixado na vareta] O sólido obtido foi um(a):",
    opcoes: { A: "cone.", B: "cilindro.", C: "pirâmide.", D: "tronco de cone.", E: "tronco de pirâmide." }
  },
  {
    numero: 41, resposta: "B", dificuldade: "Fácil",
    enunciado: "(ENEM 2024) Uma professora de matemática utiliza em suas aulas uma \"máquina caça-números\" para verificar os conhecimentos de seus estudantes sobre representações de números racionais. Essa máquina tem um visor dividido em seis compartimentos e, na lateral, uma alavanca. Cada estudante puxa a alavanca e espera que os compartimentos parem de girar. A partir daí, precisa responder para a professora em quais posições se encontram os números que representam a mesma quantidade. Um estudante puxou a alavanca e observou no visor: I: 4^(1/2), II: 4½, III: 10/45, IV: 18/4, V: 4,5, VI: 4/5. Esse estudante respondeu corretamente à pergunta da professora. As posições indicadas pelo estudante foram:",
    opcoes: { A: "I, II e IV.", B: "II, IV e V.", C: "II, III e V.", D: "III, V e VI.", E: "III, IV e VI." }
  },
  {
    numero: 42, resposta: "E", dificuldade: "Médio",
    enunciado: "(ENEM 2024) Em uma empresa é comercializado um produto em embalagens em formato de cilindro circular reto, com raio medindo 3 cm, e altura medindo 15 cm. Essa empresa planeja comercializar o mesmo produto em embalagens em formato de cubo, com capacidade igual a 80% da capacidade da embalagem cilíndrica utilizada atualmente. Use 3 como valor aproximado para π. A medida da aresta da nova embalagem, em centímetro, deve ser:",
    opcoes: { A: "6", B: "18", C: "6√6", D: "6∛6", E: "3∛12" }
  },
  {
    numero: 43, resposta: "A", dificuldade: "Fácil",
    enunciado: "(ENEM 2024) O gráfico apresenta o valor total de exportações e o valor total de importações, ao longo de um período, em bilhão de dólares (Jun. 2009 a Jun. 2010). [IMAGEM_PENDENTE: gráfico de exportações e importações] O saldo da balança comercial brasileira é dado pelo valor total de exportações menos o valor total de importações num mesmo período. Considere que os saldos da balança comercial brasileira, nos três meses destacados no gráfico, sejam representados por: S1: saldo em junho de 2009; S2: saldo em janeiro de 2010; S3: saldo em junho de 2010. A ordenação dos saldos S1, S2 e S3, do maior para o menor, é:",
    opcoes: { A: "S1, S3 e S2", B: "S2, S1 e S3", C: "S2, S3 e S1", D: "S3, S1 e S2", E: "S3, S2 e S1" }
  },
  {
    numero: 44, resposta: "D", dificuldade: "Médio",
    enunciado: "(ENEM 2024) Atualmente, há telefones celulares com telas de diversos tamanhos e em formatos retangulares. Alguns deles apresentam telas medindo 3½ polegadas. Além disso, em muitos modelos, com a inclusão de novas funções no celular, suas telas ficaram maiores, sendo muito comum encontrarmos atualmente telas medindo 4⅚ polegadas. A diferença de tamanho, em valor absoluto, entre as medidas, em polegada, das telas do celular 2 e do celular 1, representada apenas com uma casa decimal, é:",
    opcoes: { A: "0,1.", B: "0,5.", C: "1,0.", D: "1,3.", E: "1,8." }
  },
  {
    numero: 45, resposta: "A", dificuldade: "Difícil",
    enunciado: "(ENEM 2024) Um jardineiro dispõe de k metros lineares de cerca baixa para fazer um jardim ornamental. O jardim, delimitado por essa cerca, deve ter a forma de um triângulo equilátero, um quadrado ou um hexágono regular. A escolha será pela forma que resulte na maior área. O jardineiro escolherá a forma de:",
    opcoes: {
      A: "hexágono regular, pois a área do jardim, em metro quadrado, será K²√3/24",
      B: "hexágono regular, pois a área do jardim, em metro quadrado, será 3K²√3/2",
      C: "quadrado, pois a área do jardim, em metro quadrado, será K²/16",
      D: "triângulo equilátero, pois a área do jardim, em metro quadrado, será K²√3/36",
      E: "triângulo equilátero, pois a área do jardim, em metro quadrado, será K²√3/4"
    }
  }
];

// Calibração dos coeficientes TRI com base na dificuldade
function getTriParams(dificuldade: string) {
  const norm = dificuldade.trim().toLowerCase();
  if (norm === "fácil" || norm === "facil") {
    return { tri_a: 1.0, tri_b: -1.2, tri_c: 0.20 };
  } else if (norm === "difícil" || norm === "dificil") {
    return { tri_a: 1.5, tri_b: 1.6, tri_c: 0.20 };
  } else {
    // Médio
    return { tri_a: 1.2, tri_b: 0.2, tri_c: 0.20 };
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log("🔗 Conectando ao banco de dados...");

  // 1. Garantir que a matéria existirá
  const { data: subject, error: subError } = await supabase
    .from("subjects")
    .select("id")
    .eq("name", "Simulado dos Professores")
    .maybeSingle();

  let subjectId = subject?.id;
  if (!subjectId) {
    const { data: newSub, error: newSubErr } = await supabase
      .from("subjects")
      .insert({ name: "Simulado dos Professores" })
      .select("id")
      .single();
    
    if (newSubErr) {
      throw new Error(`Erro ao criar disciplina: ${newSubErr.message}`);
    }
    subjectId = newSub.id;
  }
  console.log(`📚 Disciplina pronta (ID: ${subjectId})`);

  // 2. Criar ou atualizar o exame
  const EXAM_TITLE = "Simulado Especial dos Professores";
  const { data: existingExam } = await supabase
    .from("exams")
    .select("id")
    .eq("title", EXAM_TITLE)
    .eq("year", 2026)
    .maybeSingle();

  let examId = existingExam?.id;
  // Nota: pdf_url NÃO é setado aqui. O PDF real é enviado pelo professor em
  // /dashboard/teacher/exams (upload -> bucket "exam_pdfs" -> pdf_url automático).
  // Rodar este script não deve sobrescrever um PDF já enviado.
  const examPayload = {
    title: EXAM_TITLE,
    description: "Simulado elaborado pelos professores do cursinho. Cálculo de notas avançado por TRI.",
    year: 2026,
    exam_type: "enem",
    is_special_cursinho: true,
    tri_score_calculated: true,
  };

  if (examId) {
    console.log(`🔄 Atualizando exame existente (ID: ${examId})...`);
    const { error: updErr } = await supabase
      .from("exams")
      .update(examPayload)
      .eq("id", examId);

    if (updErr) throw new Error(`Erro ao atualizar exame: ${updErr.message}`);
  } else {
    console.log("📥 Criando novo exame...");
    const { data: newExam, error: creErr } = await supabase
      .from("exams")
      .insert(examPayload)
      .select("id")
      .single();

    if (creErr) throw new Error(`Erro ao criar exame: ${creErr.message}`);
    examId = newExam.id;
  }
  console.log(`🎯 Exame pronto (ID: ${examId})`);

  // 3. Remover relações antigas de questões do exame (para evitar bagunçar ordens no re-run)
  const { data: oldRelations } = await supabase
    .from("exam_questions")
    .select("question_id")
    .eq("exam_id", examId);
  
  if (oldRelations && oldRelations.length > 0) {
    const questionIds = oldRelations.map(r => r.question_id);
    await supabase.from("exam_questions").delete().eq("exam_id", examId);
    // Remove as questões antigas para evitar lixo órfão no banco
    await supabase.from("questions").delete().in("id", questionIds);
    console.log(`🗑️ Limpeza executada: ${questionIds.length} questões antigas removidas.`);
  }

  // 4. Inserir as novas questões com os coeficientes de TRI
  console.log("📥 Inserindo novas questões com coeficientes TRI...");
  const questionLinks: { exam_id: string; question_id: string; order_index: number }[] = [];

  for (const q of GABARITO_RAW) {
    const params = getTriParams(q.dificuldade);
    const questionPayload = {
      question_text: q.enunciado,
      options: (["A", "B", "C", "D", "E"] as const).map((key) => ({
        key,
        text: q.opcoes[key]
      })),
      correct_answer: q.resposta,
      subject_id: subjectId,
      year: 2026,
      target_audience: "enem",
      explanation: `Dificuldade classificada pelos professores como: ${q.dificuldade}.`,
      tri_a: params.tri_a,
      tri_b: params.tri_b,
      tri_c: params.tri_c
    };

    const { data: insertedQ, error: qErr } = await supabase
      .from("questions")
      .insert(questionPayload)
      .select("id")
      .single();

    if (qErr) {
      throw new Error(`Erro ao inserir questão ${q.numero}: ${qErr.message}`);
    }

    questionLinks.push({
      exam_id: examId,
      question_id: insertedQ.id,
      order_index: q.numero
    });
  }

  // 5. Vincular questões ao exame
  console.log("🔗 Vinculando questões ao exame na tabela de junção...");
  const { error: linkErr } = await supabase
    .from("exam_questions")
    .insert(questionLinks);

  if (linkErr) {
    throw new Error(`Erro ao vincular questões ao exame: ${linkErr.message}`);
  }

  console.log("✨ Seed concluído com sucesso!");
  console.log(`   - 1 Exame criado/atualizado: ${EXAM_TITLE}`);
  console.log(`   - 45 Questões inseridas com parâmetros TRI configurados.`);
}

main().catch(err => {
  console.error("❌ Ocorreu um erro fatal no seed:", err);
  process.exit(1);
});
