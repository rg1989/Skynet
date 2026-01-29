#!/bin/bash

# Cosmic Perspective Daily Reminder
# A delightfully nerdy reminder from your AI assistant

# Array of cosmic facts
cosmic_facts=(
    "The Milky Way galaxy is moving through space at 2.1 million km/h"
    "A day on Venus is longer than its year (243 Earth days vs 225 Earth days)"
    "Neutron stars are so dense that a teaspoon would weigh 6 billion tons"
    "There are more possible chess games than atoms in the observable universe"
    "Saturn's moon Titan has lakes and rivers of liquid methane"
    "The observable universe contains roughly 2 trillion galaxies"
    "Light from the sun takes 8 minutes and 20 seconds to reach Earth"
    "Bananas are slightly radioactive due to potassium-40"
    "A single cloud can weigh more than a million pounds"
    "The closest star to us (after the sun) is 4.37 light-years away"
)

# Pick a random fact
fact_index=$((RANDOM % ${#cosmic_facts[@]}))
today_fact="${cosmic_facts[$fact_index]}"

# Calculate approximate Mars Sol (days since Jan 1, 2000, adjusted for Mars day length)
mars_sol=$(( ($(date +%s) - 946684800) / 88775 ))

# Create the message
echo "🌌 COSMIC PERSPECTIVE REMINDER 🌌"
echo "=================================="
echo ""
echo "Today's cosmic fact:"
echo "• $today_fact"
echo ""
echo "Current time around the cosmos:"
echo "• Your local time: $(date '+%I:%M %p on %A, %B %d')"
echo "• UTC (Greenwich): $(TZ=UTC date '+%I:%M %p')"
echo "• Tokyo: $(TZ=Asia/Tokyo date '+%I:%M %p')"
echo "• Mars Sol (approx): Sol $mars_sol of the mission"
echo ""
echo "Remember: You are made of star stuff, contemplating the stars! ⭐"
echo "=================================="
