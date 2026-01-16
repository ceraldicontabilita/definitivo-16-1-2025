#!/usr/bin/env python3
"""
Script per correggere TUTTI gli insert_one senza .copy()
Trasforma: insert_one(documento)  ->  insert_one(documento.copy())
"""
import os
import re
import sys

def fix_insert_one_in_file(filepath):
    """Corregge tutti gli insert_one senza .copy() in un file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ❌ Errore lettura {filepath}: {e}")
        return 0
    
    original_content = content
    fixes_count = 0
    
    # Pattern per trovare insert_one che NON hanno già .copy()
    # Cattura: insert_one(variabile) o insert_one({...}) o insert_one(dict(...))
    
    # Pattern 1: insert_one(variabile) dove variabile non ha .copy()
    pattern1 = r'insert_one\(([a-zA-Z_][a-zA-Z0-9_]*)\)'
    def replace1(match):
        var = match.group(1)
        if var == 'copy':  # Già ha .copy()
            return match.group(0)
        return f'insert_one({var}.copy())'
    
    # Pattern 2: insert_one({**var...}) 
    pattern2 = r'insert_one\(\{(\*\*[a-zA-Z_][a-zA-Z0-9_]*[^}]*)\}\)'
    def replace2(match):
        inner = match.group(1)
        return f'insert_one({{{inner}}}.copy())'
    
    # Pattern 3: insert_one(dict(...))
    pattern3 = r'insert_one\(dict\(([^)]+)\)\)'
    def replace3(match):
        inner = match.group(1)
        return f'insert_one(dict({inner}).copy())'
    
    # Applica le correzioni solo dove NON c'è già .copy()
    lines = content.split('\n')
    new_lines = []
    
    for line in lines:
        if 'insert_one(' in line and '.copy()' not in line and '#' not in line.split('insert_one')[0]:
            # Correggi questa riga
            original_line = line
            
            # Pattern semplice: insert_one(var) -> insert_one(var.copy())
            line = re.sub(r'insert_one\(([a-zA-Z_][a-zA-Z0-9_]*)\)', r'insert_one(\1.copy())', line)
            
            # Pattern dict(): insert_one(dict(x)) -> insert_one(dict(x).copy())
            line = re.sub(r'insert_one\(dict\(([^)]+)\)\)', r'insert_one(dict(\1).copy())', line)
            
            if line != original_line:
                fixes_count += 1
        
        new_lines.append(line)
    
    new_content = '\n'.join(new_lines)
    
    if new_content != original_content:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return fixes_count
        except Exception as e:
            print(f"  ❌ Errore scrittura {filepath}: {e}")
            return 0
    
    return 0

def main():
    app_dir = '/app/app'
    total_fixes = 0
    files_fixed = 0
    
    print("🔧 Correzione insert_one senza .copy()...")
    print("=" * 60)
    
    for root, dirs, files in os.walk(app_dir):
        # Skip __pycache__
        dirs[:] = [d for d in dirs if d != '__pycache__']
        
        for filename in files:
            if filename.endswith('.py'):
                filepath = os.path.join(root, filename)
                fixes = fix_insert_one_in_file(filepath)
                if fixes > 0:
                    rel_path = os.path.relpath(filepath, '/app')
                    print(f"  ✅ {rel_path}: {fixes} correzioni")
                    total_fixes += fixes
                    files_fixed += 1
    
    print("=" * 60)
    print(f"✅ Totale: {total_fixes} insert_one corretti in {files_fixed} file")
    return total_fixes

if __name__ == '__main__':
    sys.exit(0 if main() > 0 else 1)
