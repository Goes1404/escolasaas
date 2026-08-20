import fs from 'fs';

function parse() {
  const text = fs.readFileSync('C:/Users/eduar/Desktop/Eu/Documentos/testecompromisso/pdf_text.txt', 'utf16le');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let scoreBlocks = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === 'SIMULADOS') {
      const sim1 = lines[i+1];
      const sim2 = lines[i+2];
      scoreBlocks.push({ simulado1: sim1, simulado2: sim2 });
    }
  }

  console.log(`Found ${scoreBlocks.length} score blocks`);
  
  const names = [];
  const schools = ['Helena Chaves', 'Ana Aparecida', 'Ruth de Azevedo', 'Sebastião Florêncio', 'Padre Anacleto', 'Benedita Odette', 'Teotônio Vilela', 'Ullysses Guimarães', 'Reinaldo Santos', 'Tancredo Neves', 'Carlos Alberto', 'Manoel Jacob', 'Alba de Mello', 'Hortência', 'J.K', 'Leda Caira', 'Celina', 'João José de Oliveira', 'Imídeo Giuseppe', 'Aurélio', 'Maria Fernandes', 'Tom Jobim', 'Papa João', 'Daisy Moraes', 'Álvaro Ribeiro', 'Chácara das Garças', 'Holmes Villar', 'Georgina de Andrade', 'Aldonio Ramos Teixeira'];
  const exclude = ['VESTIBULINHO ETEC', 'MATÉRIA', 'NOTAS', 'BOLETIM ESCOLAR 2026', '1º SEM', '2º SEM', 'CURSO', 'SALA', 'ALUNO', 'Periodo', 'Tarde', 'Manhã', 'COLÉGIO', 'FALTAS/ATEST.', 'SAIDAS ANTEC.', 'Classificatorias', '1º Simulado', '2º Simulado', '3º Simulado', 'SIMULADOS', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (exclude.includes(line) || schools.includes(line)) continue;
    
    if (/^[\d\/N\/A]+$/.test(line)) continue;
    
    if (/^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][a-záéíóúâêîôûãõç]+(\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇa-záéíóúâêîôûãõç\.]+)+$/i.test(line)) {
      if (line !== line.toUpperCase()) {
        names.push(line);
      }
    }
  }
  
  console.log(`Found ${names.length} names`);
  
  const students = [];
  let blockIdx = 0;
  for (let i = 0; i < names.length; i += 4) {
    let chunkNames = names.slice(i, i + 4);
    chunkNames.sort();
    for (let j = 0; j < chunkNames.length; j++) {
      if (blockIdx < scoreBlocks.length) {
        students.push({
          name: chunkNames[j],
          ...scoreBlocks[blockIdx]
        });
        blockIdx++;
      }
    }
  }

  fs.writeFileSync('parsed_students.json', JSON.stringify(students, null, 2));
  console.log(`Parsed ${students.length} students`);
}

parse();
