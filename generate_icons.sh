#!/bin/bash

# Create icons directory if it doesn't exist
mkdir -p icons

# Generate PNG icons in different sizes
convert -background none icons/icon.svg -resize 16x16 icons/icon16.png
convert -background none icons/icon.svg -resize 48x48 icons/icon48.png
convert -background none icons/icon.svg -resize 128x128 icons/icon128.png

echo "Icons generated successfully!" 