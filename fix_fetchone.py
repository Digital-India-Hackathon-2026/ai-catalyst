import os

directories = [
    r'c:\HACAKTHONS\SNIST\code files\ai-catalyst\backend',
    r'c:\HACAKTHONS\SNIST\code files\ai-catalyst\smart_inventory'
]

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content.replace('cursor.fetchone()[0]', 'list(cursor.fetchone().values())[0]')
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Fixed fetchone()[0] in {filepath}")

for d in directories:
    for root, _, files in os.walk(d):
        for file in files:
            if file.endswith('.py'):
                process_file(os.path.join(root, file))

print("Replacement done.")
