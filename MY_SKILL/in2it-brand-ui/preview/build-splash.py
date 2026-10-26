"""Assemble preview/splash-in2it.html from the template, the token files and the logo PNGs (embedded as base64).
Run from anywhere:  python -I build-splash.py
"""
import base64, pathlib

here = pathlib.Path(__file__).resolve().parent
root = here.parent.parent  # D:\MY_SKILL
tpl = (here / "splash-in2it.template.html").read_text(encoding="utf-8")
aura = (root / "aura-design-system" / "foundations" / "tokens.css").read_text(encoding="utf-8")
in2it = (here.parent / "brand" / "tokens.in2it.css").read_text(encoding="utf-8")
navy = base64.b64encode((here.parent / "brand" / "logo-navy.png").read_bytes()).decode()
pale_small = here / "_pale_small.png"
pale = base64.b64encode(pale_small.read_bytes()).decode()

out = (tpl.replace("/*__AURA_TOKENS__*/", aura)
          .replace("/*__IN2IT_TOKENS__*/", in2it)
          .replace("__NAVY_B64__", navy)
          .replace("__PALE_B64__", pale))
(here / "splash-in2it.html").write_text(out, encoding="utf-8")
print("wrote splash-in2it.html", len(out), "bytes")
