#!/usr/bin/env python3
"""
Web Files to Markdown Converter
Converts all .js, .css, and .html files from a folder structure to .md files
Flattens all files into a single output folder with a structure document
"""

import os
import sys
import shutil
from pathlib import Path
from datetime import datetime
import re

def sanitize_filename(filename):
    """
    Create a safe filename from original path
    """
    # Remove special characters that might cause issues
    safe_name = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Limit length
    if len(safe_name) > 200:
        name_part = safe_name[:150]
        ext_part = safe_name[-50:] if '.' in safe_name else ''
        safe_name = name_part + ext_part
    return safe_name

def get_file_info(file_path, source_root):
    """
    Get relative path and metadata for a file
    """
    rel_path = file_path.relative_to(source_root)
    return {
        'original_path': str(rel_path),
        'parent_folder': str(rel_path.parent) if rel_path.parent != Path('.') else 'root',
        'name': file_path.stem,
        'extension': file_path.suffix[1:],
        'size': file_path.stat().st_size,
        'modified': datetime.fromtimestamp(file_path.stat().st_mtime)
    }

def convert_to_markdown(file_path, ext):
    """
    Convert file content to Markdown with appropriate syntax highlighting
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        # Try with different encoding for older files
        try:
            with open(file_path, 'r', encoding='latin-1') as f:
                content = f.read()
        except Exception as e:
            return f"# Error\n\nCould not read file: {str(e)}\n\n## Binary or unsupported encoding"
    
    # Choose language for syntax highlighting
    language_map = {
        '.js': 'javascript',
        '.css': 'css',
        '.html': 'html'
    }
    language = language_map.get(ext, '')
    
    # Build markdown content
    md_lines = []
    md_lines.append(f"# {file_path.name}\n")
    md_lines.append(f"**Original file:** `{file_path.name}`\n")
    md_lines.append(f"**File type:** {ext.upper()}\n")
    md_lines.append(f"**Size:** {file_path.stat().st_size:,} bytes\n")
    md_lines.append(f"**Last modified:** {datetime.fromtimestamp(file_path.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')}\n")
    md_lines.append("\n---\n")
    
    if language:
        md_lines.append(f"## Content\n\n```{language}\n{content}\n```\n")
    else:
        md_lines.append(f"## Content\n\n```\n{content}\n```\n")
    
    # Add metadata footer
    md_lines.append("\n---\n")
    md_lines.append(f"*Converted from `{file_path.name}` on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n")
    
    return "\n".join(md_lines)

def generate_structure_markdown(source_folder, all_files, output_folder):
    """
    Generate a markdown file showing the folder structure
    """
    lines = []
    lines.append(f"# Source Folder Structure\n")
    lines.append(f"**Source path:** `{source_folder.absolute()}`\n")
    lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    lines.append(f"**Total files found:** {len(all_files)}\n")
    
    # Breakdown by file type
    js_count = len([f for f in all_files if f.suffix == '.js'])
    css_count = len([f for f in all_files if f.suffix == '.css'])
    html_count = len([f for f in all_files if f.suffix == '.html'])
    
    lines.append("\n## File Type Breakdown\n")
    lines.append(f"- **JavaScript (.js):** {js_count} files")
    lines.append(f"- **CSS (.css):** {css_count} files")
    lines.append(f"- **HTML (.html):** {html_count} files")
    lines.append(f"- **Total:** {js_count + css_count + html_count} files\n")
    
    lines.append("\n## Directory Structure\n")
    lines.append("```\n")
    
    # Generate tree structure
    def add_to_tree(path, tree_dict):
        parts = path.parts
        current = tree_dict
        for part in parts:
            if part not in current:
                current[part] = {}
            current = current[part]
    
    # Build tree dictionary
    tree = {}
    for file_path in all_files:
        rel_path = file_path.relative_to(source_folder)
        add_to_tree(rel_path.parent if rel_path.parent != Path('.') else Path('.'), tree)
    
    # Print tree recursively
    def print_tree(node, prefix="", is_last=True):
        lines_content = []
        items = sorted(node.items())
        for i, (name, subtree) in enumerate(items):
            is_last_item = (i == len(items) - 1)
            connector = "└── " if is_last_item else "├── "
            lines_content.append(f"{prefix}{connector}{name}/")
            
            extension = "    " if is_last_item else "│   "
            lines_content.extend(print_tree(subtree, prefix + extension, is_last_item))
        return lines_content
    
    if tree:
        structure_lines = print_tree(tree)
        lines.extend(structure_lines)
        
        # Add files under each folder
        lines.append("\n### Files by Location\n")
        
        # Group files by folder
        folders = {}
        for file_path in all_files:
            rel_path = file_path.relative_to(source_folder)
            folder = rel_path.parent if rel_path.parent != Path('.') else Path('.')
            if folder not in folders:
                folders[folder] = []
            folders[folder].append(file_path.name)
        
        for folder in sorted(folders.keys()):
            if str(folder) == '.':
                lines.append(f"\n#### Root Directory\n")
            else:
                lines.append(f"\n#### `{folder}/`\n")
            
            for file_name in sorted(folders[folder]):
                # Find the file extension for icon
                ext = Path(file_name).suffix
                icon = "📄"
                if ext == '.js':
                    icon = "📜"
                elif ext == '.css':
                    icon = "🎨"
                elif ext == '.html':
                    icon = "🌐"
                
                # Link to the converted markdown file
                safe_name = sanitize_filename(f"{folder}_{file_name}" if str(folder) != '.' else file_name)
                md_file = safe_name.replace(Path(file_name).suffix, '.md')
                lines.append(f"- {icon} [{file_name}]({md_file})")
    
    lines.append("\n```\n")
    
    # Add mapping table
    lines.append("\n## File Mapping\n")
    lines.append("| Original File | Converted to | Type | Size |\n")
    lines.append("|--------------|--------------|------|------|\n")
    
    for file_path in sorted(all_files):
        rel_path = file_path.relative_to(source_folder)
        safe_name = sanitize_filename(f"{rel_path.parent}_{file_path.name}" if rel_path.parent != Path('.') else file_path.name)
        md_name = safe_name.replace(file_path.suffix, '.md')
        
        ext = file_path.suffix
        type_icon = "📜" if ext == '.js' else "🎨" if ext == '.css' else "🌐"
        size = f"{file_path.stat().st_size:,} bytes"
        
        lines.append(f"| {type_icon} `{rel_path}` | [{md_name}]({md_name}) | {ext.upper()[1:]} | {size} |\n")
    
    return "\n".join(lines)

def convert_web_files(source_folder, output_folder):
    """
    Main conversion function
    """
    source_path = Path(source_folder)
    output_path = Path(output_folder)
    
    # Validate source folder
    if not source_path.exists():
        print(f"❌ Error: Source folder '{source_folder}' not found")
        return False
    
    if not source_path.is_dir():
        print(f"❌ Error: '{source_folder}' is not a directory")
        return False
    
    # Create output folder (clear if exists)
    if output_path.exists():
        print(f"⚠️  Output folder '{output_folder}' already exists")
        response = input("Do you want to overwrite it? (y/N): ")
        if response.lower() != 'y':
            print("Operation cancelled")
            return False
        shutil.rmtree(output_path)
    
    output_path.mkdir(parents=True)
    print(f"📁 Created output folder: {output_path}")
    
    # Find all .js, .css, .html files
    extensions = ['*.js', '*.css', '*.html']
    all_files = []
    
    print(f"\n🔍 Scanning {source_path} for files...")
    for ext in extensions:
        files = list(source_path.rglob(ext))
        all_files.extend(files)
        print(f"   Found {len(files)} {ext} files")
    
    if not all_files:
        print("\n❌ No .js, .css, or .html files found!")
        return False
    
    print(f"\n📊 Total files to convert: {len(all_files)}")
    
    # Convert each file
    converted_count = 0
    error_count = 0
    
    print("\n🔄 Converting files...")
    for file_path in all_files:
        try:
            # Generate safe output filename
            rel_path = file_path.relative_to(source_path)
            
            # Create a unique name by including folder structure to avoid collisions
            if rel_path.parent != Path('.'):
                safe_name = sanitize_filename(f"{rel_path.parent}_{file_path.stem}")
            else:
                safe_name = sanitize_filename(file_path.stem)
            
            output_file = output_path / f"{safe_name}.md"
            
            # Handle duplicate names
            counter = 1
            while output_file.exists():
                output_file = output_path / f"{safe_name}_{counter}.md"
                counter += 1
            
            # Convert content
            md_content = convert_to_markdown(file_path, file_path.suffix)
            
            # Write markdown file
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(md_content)
            
            converted_count += 1
            
            # Progress indicator
            if converted_count % 10 == 0:
                print(f"   Progress: {converted_count}/{len(all_files)} files converted")
                
        except Exception as e:
            error_count += 1
            print(f"   ❌ Error converting {file_path.name}: {str(e)}")
    
    # Generate structure document
    print("\n📝 Generating folder structure document...")
    structure_content = generate_structure_markdown(source_path, all_files, output_path)
    structure_file = output_path / "FOLDER_STRUCTURE.md"
    
    with open(structure_file, 'w', encoding='utf-8') as f:
        f.write(structure_content)
    
    # Create a summary file
    summary_path = output_path / "CONVERSION_SUMMARY.md"
    js_files = [f for f in all_files if f.suffix == '.js']
    css_files = [f for f in all_files if f.suffix == '.css']
    html_files = [f for f in all_files if f.suffix == '.html']
    
    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write(f"# Conversion Summary\n\n")
        f.write(f"**Source:** `{source_path.absolute()}`\n")
        f.write(f"**Destination:** `{output_path.absolute()}`\n")
        f.write(f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write(f"## Statistics\n\n")
        f.write(f"- **Total files found:** {len(all_files)}\n")
        f.write(f"- **JavaScript files (.js):** {len(js_files)}\n")
        f.write(f"- **CSS files (.css):** {len(css_files)}\n")
        f.write(f"- **HTML files (.html):** {len(html_files)}\n")
        f.write(f"- **Successfully converted:** {converted_count}\n")
        f.write(f"- **Errors:** {error_count}\n\n")
        
        if error_count > 0:
            f.write(f"## Errors\n\n")
            f.write(f"Some files could not be converted. Check the console output for details.\n\n")
        
        f.write(f"## Output Files\n\n")
        f.write(f"- **Folder structure:** [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md)\n")
        f.write(f"- **This summary:** [CONVERSION_SUMMARY.md](CONVERSION_SUMMARY.md)\n")
        f.write(f"- **Converted files:** {converted_count} markdown files in this folder\n")
    
    # Final report
    print("\n" + "="*60)
    print(f"✅ CONVERSION COMPLETE!")
    print("="*60)
    print(f"📊 Files converted: {converted_count}/{len(all_files)}")
    print(f"❌ Errors: {error_count}")
    print(f"📁 Output folder: {output_path.absolute()}")
    print(f"📄 Structure file: {structure_file.name}")
    print(f"📋 Summary file: {summary_path.name}")
    
    # List output files
    md_files = list(output_path.glob("*.md"))
    print(f"\n📄 Generated {len(md_files)} markdown files:")
    for md_file in sorted(md_files)[:10]:  # Show first 10
        print(f"   - {md_file.name}")
    if len(md_files) > 10:
        print(f"   ... and {len(md_files) - 10} more")
    
    return True

def main():
    """
    Command line interface
    """
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Convert all .js, .css, and .html files from a folder structure to .md files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python web_to_markdown.py ./my_website ./markdown_output
  python web_to_markdown.py /home/user/project ./converted
  python web_to_markdown.py . ./output

The script will:
  - Scan source folder and all subfolders for .js, .css, .html files
  - Convert each file to a .md file with syntax highlighting
  - Flatten all output into a single folder
  - Create FOLDER_STRUCTURE.md showing the original hierarchy
  - Handle duplicate filenames by adding numbers
        """
    )
    
    parser.add_argument('source', help='Source folder to scan for files')
    parser.add_argument('output', help='Output folder for markdown files')
    parser.add_argument('--version', action='version', version='1.0.0')
    
    args = parser.parse_args()
    
    success = convert_web_files(args.source, args.output)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()