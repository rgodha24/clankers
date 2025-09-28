# Clanker - OpenCode Edition

Clanker is a terminal TUI application to multiplex multiple OpenCode instances (replacing Claude Code) for parallel coding tasks.

the architecture is that the frontend (a tui) is in a different directory and you cant rly access it. the backend src/api.ts can mabye run on a different computer from where the frontend is running. there used to be a lot more in this file so look at the version of it in commit a537bf8be3cd if u want more on how the architecture works (but most of that is outdated)
