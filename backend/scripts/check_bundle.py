import urllib.request
import re

html = urllib.request.urlopen("https://cloudpilot-rho.vercel.app").read().decode("utf-8")
js_match = re.search(r'assets/index-[^"\']+\.js', html)
if js_match:
    js_url = f"https://cloudpilot-rho.vercel.app/{js_match.group(0)}"
    print("Checking bundle:", js_url)
    js = urllib.request.urlopen(js_url).read().decode("utf-8")
    print("Contains 'cloudpilot-l3ht':", "cloudpilot-l3ht" in js)
    print("Contains 'localhost:8000':", "localhost:8000" in js)
    if "cloudpilot-l3ht" not in js:
        print("WARNING: VITE_BACKEND_URL was NOT baked into this build! It defaulted to localhost:8000!")
