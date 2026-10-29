"""Pack or unpack the encrypted scorecard pipeline (tools/pipeline.bin).
The key is the base64 AES-256 key in Supabase public.page_keys (name 'supplier-scorecard'), passed as PAGE_KEY.
  PAGE_KEY=... python3 tools/bundle.py unpack tools/pipeline.bin <dir>
  PAGE_KEY=... python3 tools/bundle.py pack <dir> tools/pipeline.bin"""
import base64, io, os, sys, tarfile
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
key = base64.b64decode(os.environ['PAGE_KEY'])
mode, src, dst = sys.argv[1:4]
SKIP = ('out', '__pycache__')
if mode == 'pack':
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz') as t:
        for root, dirs, files in os.walk(src):
            dirs[:] = [d for d in dirs if d not in SKIP]
            for f in files:
                p = os.path.join(root, f); t.add(p, arcname=os.path.relpath(p, src))
    iv = os.urandom(12)
    open(dst, 'wb').write(b'GBR1' + iv + AESGCM(key).encrypt(iv, buf.getvalue(), None))
    print('packed', dst, os.path.getsize(dst) // 1024, 'KB')
elif mode == 'unpack':
    raw = open(src, 'rb').read(); assert raw[:4] == b'GBR1', 'not a pipeline bundle'
    data = AESGCM(key).decrypt(raw[4:16], raw[16:], None)
    os.makedirs(dst, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as t:
        t.extractall(dst, filter='data')
    print('unpacked into', dst)
