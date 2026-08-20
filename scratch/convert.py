import os
import re

files = [
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
]

replacements = {
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
    'text-white': 'text-slate-800',
    'bg-[#111113]': 'bg-white',
    'bg-[#131316]': 'bg-white',
    'bg-[#1a1a1f]': 'bg-white'
}

def process_chunk(chunk):
    for old, new in replacements.items():
        # Only replace exact words where applicable, using regex boundaries to avoid replacing "text-white" inside "text-white/50"
        if old == 'text-white':
            chunk = re.sub(r'text-white(?![/a-zA-Z0-9-])', new, chunk)
        else:
            chunk = chunk.replace(old, new)
    return chunk

for file_path in files:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We need to preserve the Hero div which contains bg-[#0d0d0f]
    # We will find the Hero div by searching for bg-[#0d0d0f]
    # The Hero div usually ends with </div>\n      </div>
    
    parts = content.split('bg-[#0d0d0f]')
    if len(parts) == 1:
        # No hero div, process the whole thing? Wait, TeacherAnalyticsDashboard has bg-[#0d0d0f]
        new_content = process_chunk(content)
    else:
        # parts[0] is before hero. parts[1] contains the rest of the hero and the page.
        # Let's find the end of the Hero div. It's usually `</div>\n      </div>`
        hero_end_match = re.search(r'</div>\s*</div>\s*</div>', parts[1])
        if hero_end_match:
            end_idx = hero_end_match.end()
            hero_content = parts[1][:end_idx]
            rest_content = parts[1][end_idx:]
            
            # Reconstruct
            new_content = parts[0] + 'bg-[#0d0d0f]' + hero_content + process_chunk(rest_content)
        else:
            new_content = process_chunk(content)
            
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
