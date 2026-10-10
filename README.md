# AI Coding Challenge 2026 — Participant Launchpad

A premium, mobile-friendly **static event portal** for three coding teams. Built with plain HTML, CSS, and a tiny, self-contained JavaScript snippet. No frameworks, cookies, trackers, analytics, external fonts, or third-party scripts.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Event homepage, team cards, setup guide, terminal tabs, and FAQs |
| `style.css` | Responsive UI, gradients, animations, accessible focus states |
| `opencode.json` | **Public starter template only**; no live AI Hub provider configuration or credentials |
| `README.md` | Setup, deployment, security, and handover guidance |

## Publish to GitHub Pages

1. Create a **separate PUBLIC repository** for this website (not one of the private team repositories).
2. Upload these four files into its root directory.
3. In the public repo go to **Settings → Pages → Build and deployment**.
4. Choose **Deploy from a branch**, branch **main**, folder **/(root)**. Save.
5. Visit the generated Pages URL; it often resembles `https://USERNAME.github.io/REPO-NAME/`.
6. Create a QR code containing **that public Pages URL only**, using an approved offline QR generator. It is safe to print it on team cards after verifying the site contains no sensitive details.

> GitHub Pages is a **public website**. A public page linking to private repos does not make those repos public, but repo names/URLs visible on the page are themselves public information. Obtain internal permission before publishing company/event details.

## Customize team repository links

Open `index.html` in GitHub's web editor and search for **`data-repository-url=""`**. It appears **three times**, once on each team card's button. Add the appropriate HTTPS repository page URL inside each pair of quotes:

```html
<a class="team-link is-disabled" data-repo-link="1"
   data-repository-url="https://github.com/YOUR_ACCOUNT/team-alpha"
   aria-disabled="true" tabindex="-1">
```

The same pattern applies to teams 2 and 3. The page safely activates the links automatically.

- URL must be exactly `https://github.com/OWNER/REPOSITORY` (optional trailing slash).
- Never add API keys, password, GitHub personal access tokens, or sensitive data to repository URLs.
- The page shows `LINK PENDING` until a valid URL is set. Once a valid URL is provided, the card opens that GitHub repository in a new tab.
- **No JavaScript changes or hash regeneration are needed to replace team URLs.** The page validates them as HTTPS URLs at `github.com`.
- A public webpage linking to private GitHub repositories does not give access; users must still have their own authorized GitHub credentials.

### If you edit the inline JavaScript itself (advanced)

The page ships with a strict Content Security Policy (CSP) containing a SHA-256 hash of its inline JavaScript. Editing scripts requires updating the hash or the script will be blocked. Changing URLs in the **HTML attributes above does not affect the hash**. For advanced script updates, run Python 3 in this folder:

```python
from pathlib import Path
from hashlib import sha256
import base64, re
p = Path('index.html')
s = p.read_text(encoding='utf-8')
script = re.search(r'<script>(.*?)</script>', s, re.S).group(1)
digest = base64.b64encode(sha256(script.encode('utf-8')).digest()).decode('ascii')
s = re.sub(r"script-src 'sha256-[^']+'", "script-src 'sha256-" + digest + "'", s, count=1)
p.write_text(s, encoding='utf-8')
```

Do not remove the CSP as a shortcut.

## Participant onboarding (one coding laptop per team)

1. **Confirm access** to the correct private repository. Invite that team's authorized GitHub account(s) as collaborators. Never log students into the organizer's personal GitHub account or store the organizer's personal access token on their devices.
2. **Install Git and Node.js LTS** from official sources; verify `git --version` and `node --version`.
3. **Install OpenCode** using `npm.cmd install -g opencode-ai` in Windows PowerShell, or `npm install -g opencode-ai` in macOS Terminal. Use `opencode.cmd` for PowerShell if script execution policy prevents `opencode` from launching.
4. **Clone the team repository** with its GitHub HTTPS URL, and change directory into the project root.
5. **Place `opencode.json` into that project root**, not only the public website repo. The downloaded file is a **non-functional security-minded starter**: the organizer must provide the actual approved provider ID, API endpoint, SDK adapter, and model ID from the company's validated internal settings. Do not guess or publish these without authorization.
6. **Give each device its own API key through the approved private channel** (or configure it directly on the laptop). In OpenCode, use `/connect` and select the configured provider; make sure the provider ID matches the actual `opencode.json`. Use `/models` to choose a configured model, and test with a harmless prompt.
7. **Check connectivity from the students' network**. Even a valid API key will not bypass SSO, VPN, or firewall restrictions. A test from the organizer's company laptop is not sufficient.
8. **Verify Git permissions and push workflow** before kickoff. Repo access, key validity, and edit permissions are distinct checks.

If participants cannot obtain GitHub accounts or access, the organizer may provide a checked, non-secret ZIP of the starter project through an approved channel. Collaboration/pushing then needs a separate solution.

## Important security notes

- **Never embed device API keys into QR codes or public pages.** QR is an encoding, not encryption; anyone who scans or photographs it can read its text. An online QR-generation site might also receive the input.
- Never store tokens in this repository, team repositories, terminal screenshots, prompt history, issue text, README files, or ChatGPT conversations.
- Keep credentials in the authentication storage supported by the approved OpenCode configuration. Avoid passing secrets in shell command arguments or committing `.env` files.
- The starter config requests confirmation before shell commands and accesses to external directories on compatible OpenCode versions. It is not a sandbox, and it cannot protect against all dangerous commands or agent behavior.
- Prefer short-lived, per-device, rate-limited keys. Arrange immediate revocation after the competition, and test revocation.
- The website uses a strict CSP and does not call any backend. It does **not** accept, store, or transmit keys.
- Do not put internal network addresses, non-public model details, or proprietary challenge data on public GitHub Pages unless authorized.

## Configuring the AI Hub provider

The included `opencode.json` deliberately contains **no** company-specific provider. Add your approved provider according to the OpenCode version and API compatibility:

- Official OpenCode provider documentation: https://opencode.ai/docs/providers/
- Official OpenCode configuration documentation: https://opencode.ai/docs/config/

**The `npm` provider adapter and `options.baseURL` are version/interface-specific.** Verify the exact production-approved JSON against the installed OpenCode release and a real test device. If your official internal AI Hub configuration differs, use that as the source of truth and keep secrets out of the project file.

## Quality and accessibility

- Mobile-first responsive layout; tested for narrow phone screens and desktop.
- Focus indicators, skip link, tab semantics, live copy feedback, `<details>` FAQ, reduced-motion support.
- Links to third parties use `noopener noreferrer` and a `no-referrer` policy.
- No external font, icon library, remote image, npm build step, CDN, or runtime service.

**Before go-live:** insert actual authorized team links, open the live Pages URL on phone + laptop, and test the actual approved AI Hub connection from a participant network.
