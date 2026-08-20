const fs = require('fs');

const files = [
  'src/app/dashboard/teacher/help/page.tsx',
  'src/app/dashboard/teacher/essays/page.tsx'
];

const replacements = {
  'bg-white/3': 'bg-white shadow-sm',
  'bg-white/5': 'bg-white shadow-sm',
  'border-white/5': 'border-slate-100',
  'border-white/6': 'border-slate-200',
  'border-white/8': 'border-slate-200',
  'border-white/10': 'border-slate-200',
  'text-white/45': 'text-slate-400',
  'text-white/50': 'text-slate-400',
  'text-white/55': 'text-slate-500',
  'text-white/60': 'text-slate-500',
  'text-white/65': 'text-slate-600',
  'text-white/70': 'text-slate-600',
  'text-white/75': 'text-slate-600',
  'placeholder:text-white/55': 'placeholder:text-slate-400',
  'hover:bg-white/5': 'hover:bg-slate-50',
  'hover:bg-white/8': 'hover:bg-slate-50',
  'hover:bg-white/10': 'hover:bg-slate-100',
  'hover:border-white/20': 'hover:border-slate-300',
  'hover:border-white/10': 'hover:border-slate-300',
  'hover:text-white/60': 'hover:text-slate-600',
  'hover:text-white': 'hover:text-slate-800',
  'bg-[#111113]': 'bg-white',
  'bg-[#131316]': 'bg-white',
  'bg-[#1a1a1f]': 'bg-white'
};

function processChunk(chunk) {
  let res = chunk;
  for (const [oldStr, newStr] of Object.entries(replacements)) {
    res = res.split(oldStr).join(newStr);
  }
  // handle text-white separately using regex
  res = res.replace(/text-white(?![/a-zA-Z0-9-])/g, 'text-slate-800');
  return res;
}

files.forEach(f => {
  if (fs.existsSync(f)) {
    const content = fs.readFileSync(f, 'utf8');
    const parts = content.split('bg-[#0d0d0f]');
    
    // Instead of doing something clever with `</div>`, let's just observe that in essays, the second bg-[#0d0d0f] is the "AI Score" div. It is a dark card. We can keep it dark.
    // In help/page.tsx, there might be multiple dark cards.
    // Actually, any div that starts with bg-[#0d0d0f] was MEANT to be dark! So we shouldn't touch its contents.
    // To do this simply: any string between `bg-[#0d0d0f]` and its closing `</div>` should be preserved.
    // Since nested divs make this hard, what if we just DO NOT process chunks that start with `bg-[#0d0d0f]`?
    
    let result = '';
    
    // First part is definitely light theme stuff
    result += processChunk(parts[0]);
    
    for (let i = 1; i < parts.length; i++) {
      // Find where this `bg-[#0d0d0f]` div ends.
      // This is hard to do with regex.
      // Instead, we can just find `</div>\n` and assume that's the end of the dark card?
      // Actually, since there are only 2 files, let's just do it manually.
    }
  }
});
