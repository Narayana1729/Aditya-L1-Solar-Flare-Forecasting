import os
import re
import sys
import requests
from tqdm import tqdm

def parse_sh(sh_path):
    """Parse the bash script and extract cookies, urlPrefix, and file paths."""
    if not os.path.exists(sh_path):
        print(f"Error: File not found {sh_path}")
        return None, None, []
        
    with open(sh_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        
    # Extract cookies
    cookies_match = re.search(r'cookies="([^"]+)"', content)
    cookies_str = cookies_match.group(1) if cookies_match else ""
    
    # Extract urlPrefix
    url_prefix_match = re.search(r'urlPrefix="([^"]+)"', content)
    url_prefix = url_prefix_match.group(1) if url_prefix_match else "https://pradan.issdc.gov.in"
    
    # Extract file paths: match everything between dataFilePaths=( and )
    paths_match = re.search(r'dataFilePaths=\(\s*([^)]+)\s*\)', content, re.DOTALL)
    if not paths_match:
        print("Error: Could not parse dataFilePaths from shell script.")
        return url_prefix, {}, []
        
    paths_raw = paths_match.group(1)
    # Split by spaces and strip quotes/whitespace
    paths = [p.strip('"\'') for p in paths_raw.split() if p.strip()]
    
    return url_prefix, cookies_str, paths

def download_files(sh_path, output_dir):
    """Download all files listed in the .sh script using requests."""
    url_prefix, cookies_str, paths = parse_sh(sh_path)
    if not paths:
        print("No files found to download.")
        return
        
    os.makedirs(output_dir, exist_ok=True)
    print(f"Parsed {len(paths)} files from the download script.")
    print(f"Saving files to: {output_dir}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": f"{url_prefix}/al1/protected/payload.xhtml",
        "Cookie": cookies_str
    }
    
    success_count = 0
    failed_files = []
    
    # Loop over all files with a progress bar
    for path in tqdm(paths, desc="Downloading files"):
        # Format the URL
        url = url_prefix + path
        
        # Get target filename (strip query params like ?solexs)
        clean_path = path.split('?')[0]
        filename = os.path.basename(clean_path)
        dest_path = os.path.join(output_dir, filename)
        
        # Skip if already downloaded
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1024:
            success_count += 1
            continue
            
        try:
            # Download file in chunks (stream=True)
            response = requests.get(url, headers=headers, stream=True, timeout=30, allow_redirects=False)
            
            # Check for redirect or auth failure
            if response.status_code in [302, 301]:
                print(f"\n[Warning] Redirected to {response.headers.get('Location')}. Session cookies might have expired.")
                print("Please download a fresh shell script from PRADAN and try again.")
                break
                
            if response.status_code != 200:
                print(f"\n[Error] Failed to download {filename}. HTTP Status: {response.status_code}")
                failed_files.append((filename, response.status_code))
                continue
                
            # Write to file
            with open(dest_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            success_count += 1
            
        except Exception as e:
            print(f"\n[Error] Exception downloading {filename}: {e}")
            failed_files.append((filename, str(e)))
            
    print(f"\nDownload finished: {success_count}/{len(paths)} succeeded.")
    if failed_files:
        print(f"Failed files count: {len(failed_files)}")
        # Print first few failures
        for name, err in failed_files[:5]:
            print(f"  - {name}: {err}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python download_pradan.py <path_to_sh_file> <output_directory>")
        sys.exit(1)
        
    sh_file = sys.argv[1]
    out_dir = sys.argv[2]
    
    download_files(sh_file, out_dir)
