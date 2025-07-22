import os

# List of files to read
files_to_read = ['models.py', 'urls.py', 'views.py', 'serializers.py','admin.py']
output_file = 'django_files_content.txt'

with open(output_file, 'w', encoding='utf-8') as outfile:
    for filename in files_to_read:
        # Write a header for each file section
        outfile.write(f"===== Content of {filename} =====\n\n")

        try:
            with open(filename, 'r', encoding='utf-8') as infile:
                outfile.write(infile.read())
        except FileNotFoundError:
            outfile.write(f"File {filename} not found in the current directory.\n")
        except Exception as e:
            outfile.write(f"Error reading {filename}: {str(e)}\n")

        outfile.write("\n\n")  # Add some space between files

print(f"Contents have been written to {output_file}")
