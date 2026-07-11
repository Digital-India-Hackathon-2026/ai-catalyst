import re

with open(r'backend\routes\civic.py', 'r', encoding='utf-8') as f:
    content = f.read()

# All dict() calls on DB rows that need to be serialize_row()
patterns = [
    ('user_dict = dict(user)', 'user_dict = serialize_row(user)'),
    ("user_dict['employee_details'] = dict(emp)", "user_dict['employee_details'] = serialize_row(emp)"),
]

# Also replace every remaining   = dict(  except inside serialize_row itself
lines = content.split('\n')
new_lines = []
inside_serialize = False
for i, line in enumerate(lines):
    # Skip inside serialize_row function body
    if 'def serialize_row' in line:
        inside_serialize = True
    elif inside_serialize and line.strip() and not line.startswith(' ') and not line.startswith('\t') and 'def ' in line:
        inside_serialize = False
    
    if inside_serialize:
        new_lines.append(line)
        continue
    
    # Replace patterns like: something = dict(X) where X is a single variable
    new_line = re.sub(r'= dict\((\w+)\)', lambda m: f'= serialize_row({m.group(1)})', line)
    new_lines.append(new_line)

content = '\n'.join(new_lines)

with open(r'backend\routes\civic.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done.")
