import os
import fnmatch
from pathlib import Path

# Define folders and files to ignore
IGNORE_FOLDERS = {
    '__pycache__',
    'migrations',
    'venv',
    'env',
    'node_modules',
    '.git'
}

IGNORE_FILE_PATTERNS = {
    '*.pyc',
    '*.pyo',
    '*.pyd',
    '.DS_Store',
    'thumbs.db',
    '.gitignore',
    '.env',
    '*.log'
}

def should_ignore(path, is_dir=False):
    """Check if a path should be ignored based on ignore rules"""
    # Check folder ignore
    if is_dir:
        dir_name = os.path.basename(path)
        if dir_name in IGNORE_FOLDERS:
            return True
        # Also check if any part of the path contains ignored folders
        for folder in IGNORE_FOLDERS:
            if folder in path.split(os.sep):
                return True
        return False

    # Check file ignore patterns
    filename = os.path.basename(path)
    for pattern in IGNORE_FILE_PATTERNS:
        if fnmatch.fnmatch(filename, pattern):
            return True

    # Check if file is in ignored folder
    for folder in IGNORE_FOLDERS:
        if folder in path.split(os.sep):
            return True

    return False

def get_all_files(base_dir):
    """Get all files in directory tree with relative paths, ignoring specified folders"""
    all_files = []

    for root, dirs, files in os.walk(base_dir, topdown=True):
        # Remove ignored directories from dirs list so os.walk doesn't traverse them
        dirs[:] = [d for d in dirs if not should_ignore(os.path.join(root, d), is_dir=True)]

        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, base_dir)

            # Skip ignored files
            if not should_ignore(rel_path, is_dir=False):
                all_files.append(rel_path)

    return sorted(all_files)

def display_files_with_numbers(files):
    """Display files with index numbers"""
    print("\n" + "="*70)
    print("FILES IN CURRENT DIRECTORY AND SUBDIRECTORIES (Ignoring specified folders)")
    print("="*70)

    if not files:
        print("No files found (or all files are in ignored folders).")
        return

    for idx, file in enumerate(files, 1):
        print(f"{idx:3}. {file}")

    print("="*70)
    print(f"Total files found: {len(files)}")
    print("="*70)

def select_files(files):
    """Let user select files by index numbers"""
    if not files:
        print("No files available for selection.")
        return []

    selected_files = []

    while True:
        try:
            print("\n" + "-"*50)
            print("SELECTION OPTIONS:")
            print("- Enter numbers separated by commas (e.g., '1,3,5')")
            print("- Enter ranges (e.g., '1-5')")
            print("- Enter 'all' to select all files")
            print("- Enter 'q' to quit")
            print("-"*50)

            selection = input("\nEnter file numbers to print: ").strip()

            if selection.lower() == 'q':
                return None
            elif selection.lower() == 'all':
                return files

            indices = []
            for part in selection.split(','):
                part = part.strip()
                if not part:
                    continue

                if '-' in part:
                    # Handle ranges
                    try:
                        start_str, end_str = part.split('-', 1)
                        start = int(start_str.strip())
                        end = int(end_str.strip())
                        if start <= end:
                            indices.extend(range(start, end + 1))
                        else:
                            indices.extend(range(start, end - 1, -1))
                    except ValueError:
                        print(f"Invalid range format: {part}")
                        continue
                else:
                    # Single number
                    try:
                        indices.append(int(part))
                    except ValueError:
                        print(f"Invalid number: {part}")
                        continue

            # Validate indices
            valid_indices = []
            invalid_indices = []

            for i in indices:
                if 1 <= i <= len(files):
                    valid_indices.append(i)
                else:
                    invalid_indices.append(i)

            if invalid_indices:
                print(f"Warning: Invalid indices ignored: {sorted(set(invalid_indices))}")

            if valid_indices:
                # Remove duplicates while preserving order
                seen = set()
                selected_indices = []
                for i in valid_indices:
                    if i not in seen:
                        seen.add(i)
                        selected_indices.append(i)

                selected_files = [files[i-1] for i in selected_indices]
                return selected_files
            else:
                print("No valid files selected. Please try again.")

        except KeyboardInterrupt:
            print("\nOperation cancelled.")
            return None
        except Exception as e:
            print(f"Error processing selection: {e}")

def read_file_content(file_path):
    """Read content of a file with error handling"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    except PermissionError:
        return f"[PERMISSION DENIED: Cannot read {file_path}]"
    except UnicodeDecodeError:
        return f"[BINARY FILE or ENCODING ISSUE: Cannot read as text {file_path}]"
    except Exception as e:
        return f"[ERROR reading {file_path}: {str(e)}]"

def save_files_with_content(selected_files, output_file='files_content.txt'):
    """Save file paths and their content to a text file"""
    try:
        current_dir = os.getcwd()

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("FILES AND THEIR CONTENT\n")
            f.write("=" * 80 + "\n\n")

            for idx, rel_path in enumerate(selected_files, 1):
                full_path = os.path.join(current_dir, rel_path)

                # Write file path
                f.write(f"FILE {idx}: {rel_path}\n")
                f.write("-" * 80 + "\n")

                # Read and write file content
                content = read_file_content(full_path)
                f.write(content)

                # Add separation between files (unless it's the last file)
                if idx < len(selected_files):
                    f.write("\n" + "=" * 80 + "\n\n")

        print(f"\n✓ File content saved to: {os.path.abspath(output_file)}")
        print(f"✓ Total files saved: {len(selected_files)}")
        return True
    except Exception as e:
        print(f"Error saving file content: {e}")
        return False

def filter_files_by_pattern(files):
    """Allow user to filter files by pattern"""
    print("\n" + "-"*50)
    print("FILTER OPTIONS:")
    print("Examples: *.txt, *.py, *.md, data*.csv")
    print("Press Enter to skip filtering")
    print("-"*50)

    pattern = input("\nEnter file pattern to filter: ").strip()

    if not pattern:
        return files

    filtered_files = []
    for file in files:
        if fnmatch.fnmatch(file, pattern) or fnmatch.fnmatch(os.path.basename(file), pattern):
            filtered_files.append(file)

    print(f"\n✓ Found {len(filtered_files)} files matching pattern '{pattern}'")
    return filtered_files

def main():
    print("FILE CONTENT VIEWER AND SAVER")
    print("="*70)

    # Get current working directory
    current_dir = os.getcwd()
    print(f"Current Directory: {current_dir}")

    # Get all files (excluding ignored ones)
    print("\nScanning directory tree (excluding specified folders)...")
    all_files = get_all_files(current_dir)

    if not all_files:
        print("\nNo files found (or all files are in ignored folders).")
        return

    print(f"Found {len(all_files)} files.")

    # Filter files if user wants
    filter_choice = input("\nDo you want to filter files by pattern? (y/n): ").strip().lower()
    if filter_choice == 'y':
        display_files = filter_files_by_pattern(all_files)
    else:
        display_files = all_files

    if not display_files:
        print("No files match your criteria.")
        return

    # Display files
    display_files_with_numbers(display_files)

    # Let user select files
    selected_files = select_files(display_files)

    if not selected_files:
        print("No files selected. Exiting.")
        return

    print(f"\n✓ Selected {len(selected_files)} files")

    # Save file content to text file
    default_name = 'files_content.txt'
    output_filename = input(f"\nEnter output filename (default: '{default_name}'): ").strip()
    if not output_filename:
        output_filename = default_name

    # Append .txt if not present
    if not output_filename.lower().endswith('.txt'):
        output_filename += '.txt'

    # Save files with content
    save_files_with_content(selected_files, output_filename)

    # Ask if user wants to preview any file
    preview = input("\nDo you want to preview any file content in console? (y/n): ").strip().lower()
    if preview == 'y':
        print("\n" + "="*70)
        for idx, file_path in enumerate(selected_files, 1):
            print(f"\n{idx}. {file_path}")

        preview_choice = input("\nEnter file number to preview (or 'all' for all, 'q' to skip): ").strip().lower()

        if preview_choice == 'all':
            for file_path in selected_files:
                full_path = os.path.join(current_dir, file_path)
                print(f"\n{'='*70}")
                print(f"CONTENT OF: {file_path}")
                print(f"{'='*70}")
                print(read_file_content(full_path))
        elif preview_choice != 'q':
            try:
                file_num = int(preview_choice)
                if 1 <= file_num <= len(selected_files):
                    file_path = selected_files[file_num - 1]
                    full_path = os.path.join(current_dir, file_path)
                    print(f"\n{'='*70}")
                    print(f"CONTENT OF: {file_path}")
                    print(f"{'='*70}")
                    print(read_file_content(full_path))
                else:
                    print("Invalid file number.")
            except ValueError:
                print("Invalid input.")

    print("\n" + "="*70)
    print(f"PROCESS COMPLETED")
    print(f"Files processed: {len(selected_files)}")
    print(f"Output saved to: {output_filename}")
    print("="*70)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProgram interrupted by user. Exiting.")
    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}")
