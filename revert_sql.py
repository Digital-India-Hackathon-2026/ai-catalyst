import os

directories = [
    r'c:\HACAKTHONS\SNIST\code files\ai-catalyst\backend\routes',
    r'c:\HACAKTHONS\SNIST\code files\ai-catalyst\smart_inventory\routes'
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    new_lines = []
    changed = False
    for line in lines:
        if '%s' in line and ('execute' in line or 'query' in line or 'VALUES' in line or 'WHERE' in line):
            new_lines.append(line.replace('%s', '?'))
            changed = True
        else:
            new_lines.append(line)
            
    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
        print(f"Reverted {filepath}")

for d in directories:
    for root, _, files in os.walk(d):
        for file in files:
            if file.endswith('.py'):
                process_file(os.path.join(root, file))

print("Revert to ? done.")
