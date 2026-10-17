#!/bin/bash
# Double-click to study Japanese offline. No wifi needed — this runs entirely on your Mac.
# Opens http://localhost:8787/japan/ in your browser and serves the site locally.
# Close this Terminal window (or press Ctrl+C) when you're done.

cd "$(dirname "$0")" || exit 1
PORT=8787

# Open the page once the server has a moment to start.
( sleep 1; open "http://localhost:$PORT/japan/" ) &

echo "Serving Japanese study app at http://localhost:$PORT/japan/"
echo "Leave this window open while you study. Ctrl+C to stop."
python3 -m http.server "$PORT"
