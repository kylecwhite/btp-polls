# BTP live polls

Self-hosted audience polling for Beyond the Protocols. The pages are static files
hosted on GitHub Pages; votes are stored in the Firebase project `btp-polls`
(Realtime Database, Singapore). No accounts for attendees, no vendor branding.

| Page | Who | What it does |
|---|---|---|
| `index.html` | Attendees (phone) | Shows the live question with the patient card; one vote per phone, changeable until voting closes |
| `present.html` | Presenter (second screen) | Join screen with QR, live board, controls. Sign in with Google to run polls |
| `results.html` | PowerPoint (BTP Live Results add-in) | Bars on a slide, scaled to the box. In PowerPoint each box remembers its own poll, picked while editing. In a browser, `?p=s07-p01` pins a poll; `&labels=0` drops option text; `&qr=0` drops the join code |

Add `?s=test` to any page for a dry run that keeps its votes apart from the real session.
Add `?demo` to run entirely in this browser with no database (`&fill=37` seeds fake votes).

## Running a vote

1. Open `present.html` on the second screen, press **F** for full screen, sign in.
2. Pick the poll in the toolbar: it goes live on every phone with voting open and results hidden.
3. **R** reveals results, **O** closes or reopens voting, **C** (re-votes only) shows the first vote beside this one.
4. **H** hides the toolbar. Left and right arrow keys step through the polls. With more than one session built in, a menu at the left of the toolbar picks the session.

## Results inside PowerPoint (BTP Live Results add-in)

Microsoft retired its Web Viewer add-in in December 2024, so the deck uses our own add-in: `manifest.xml`
points PowerPoint at `results.html` on the site. Sideload once per Mac: copy `manifest.xml` into
`~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef/` (create `wef` if missing) and restart
PowerPoint. Then Insert > Add-ins > My Add-ins > BTP Live Results, size the box, and choose the poll from
the picker in its top-right corner (the picker hides in slide show). The live poll's bars stay hidden until
you press R on the presenter board; a poll that is no longer live shows its final result.

## Files

- `config.js`: Firebase project settings and the presenter's Google account. Not secret.
- `polls.js`: generated. `python3 make_polls.py 7=../../07_Housekeeping_I/polling/HK1_polls.json 8=...`
  (one `session=manifest` per session; `--only 7:1,7` limits to listed polls). Re-votes are paired automatically: same patient, same options.
- `database.rules.template.json`: database rules; the deployed copy has the presenter's email filled in.
  Anyone can read results; a phone can only write its own vote, only to the poll that is open; only the
  presenter can change what is live or clear votes.
- `qrcode.js`: QR generator (MIT, Kazuhiko Arase).

## Data

`live/<session>/control` holds what is on screen. `live/<session>/votes/<poll>/<anonymous id>` holds
`{c: "1", t: <server time>}`. No names, emails or device details are stored. Export from the Firebase
console (Realtime Database, three-dot menu, Export JSON) after each course.
