import fs from 'fs';
import path from 'path';

const files = [
  'src/app/dashboard/teacher/trails/page.tsx',
  'src/app/dashboard/teacher/students/page.tsx',
  'src/app/dashboard/teacher/rankings/page.tsx',
  'src/app/dashboard/teacher/materials/page.tsx',
  'src/app/dashboard/teacher/live/page.tsx',
  'src/app/dashboard/teacher/help/page.tsx',
  'src/app/dashboard/teacher/essays/page.tsx',
  'src/app/dashboard/teacher/calendar/page.tsx',
  'src/app/dashboard/teacher/attendance/page.tsx',
  'src/app/dashboard/teacher/attendance/[id]/page.tsx',
  'src/app/dashboard/teacher/attendance/new/page.tsx',
  'src/components/TeacherAnalyticsDashboard.tsx'
];

files.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Strategy:
  // 1. Temporarily replace the Hero block with a placeholder
  // 2. Temporarily replace Dialog blocks with placeholders
  // 3. Temporarily replace SelectContent blocks with placeholders
  // 4. Do the color replacements on the rest of the file
  // 5. Restore the placeholders

  const blocks = [];
  let blockCounter = 0;

  function mask(regex) {
    content = content.replace(regex, (match) => {
      const token = `___BLOCK_${blockCounter++}___`;
      blocks.push({ token, match });
      return token;
    });
  }

  // Mask Hero section
  mask(/<div className="relative[^>]*bg-\[#0d0d0f\][\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g); // roughly masks the hero div structure. Since it's nested, regex is hard. Let's do a simpler approach.

  // Instead of masking with regex (which is unreliable for HTML), I'll just split by lines and keep a state.
});
