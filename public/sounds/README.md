# Sound effects

The game looks for these 5 short effect files in this folder
(`/public/sounds/`). They are played by `lib/sound.ts`.

| File          | Plays when                                         |
| ------------- | -------------------------------------------------- |
| `lever.mp3`   | The player presses SPIN (lever pull)               |
| `spin.mp3`    | A spin starts (reels begin rolling)                |
| `rule.mp3`    | Each rule-application step is revealed              |
| `score.mp3`   | The score panel becomes visible                    |
| `jackpot.mp3` | A jackpot celebration fires                        |

## Notes

- Drop in any CC0 / royalty-free `.mp3` clips with these exact filenames.
- These are placeholders: **if a file is absent (or playback is blocked),
  the game stays silent** — no errors. The feature degrades gracefully.
- Background music is out of scope; effects only.
- Use the 🔊 / 🔇 toggle (top-right) to mute; the setting persists in
  `localStorage` under the key `rule-slot-muted`.
