# Format: post

Posts on X: a single post, a thread or an X Article. 45–75 seconds, about 8–12 lines.

A post is short and usually makes one point, often about something bigger (a paper, a launch, a result). The video explains that one point so a viewer who never saw the post gets it.

| Beat | Lines | What the picture does |
|---|---|---|
| **Hook** | 1–2 | The post's point as a question or a surprising result. The author's name and handle are on screen from the first second. |
| **The post** | 1 | The key sentence of the post, quoted briefly, attributed. |
| **The picture** | 3–5 | The one idea behind it, shown on one picture. If the post links a paper or a product, the picture comes from there: ingest that too. |
| **So what** | 1–2 | Why it matters, in the post's terms. |
| **End** | 1 | Handle and link to the post (and to the paper, if any). |

Getting the text:
- A single public post: `ingest <slug> https://x.com/<user>/status/<id>` (X's public oEmbed, no login).
- A thread or an X Article needs a logged-in browser. Open it, copy the text into a `.md` file (or let your agent read the page in your browser), then `ingest <slug> file.md --kind post`.

Do:
- Quote the post's words exactly and briefly; credit the handle on screen.
- If the post links a paper, use the paper for the facts and the post for the angle.

Don't:
- Show the author's photo or the X interface. Use the name and handle as text.
- Add claims the post does not make.

Kit needs for this format (see ROADMAP): a post card (name, handle, the quoted sentence).
