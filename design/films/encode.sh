#!/bin/bash
# encode.sh <framesDir> <name> <outDir>  -> name.mp4 (full), name-preview.mp4 (small loop), name.jpg (poster)
set -e
F=$1; N=$2; O=$3; mkdir -p $O
ffmpeg -v error -y -framerate 30 -i $F/f%05d.jpg -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -movflags +faststart -an $O/$N.mp4
ffmpeg -v error -y -ss ${6:-0} -i $O/$N.mp4 -t ${4:-6} -vf "scale=640:-2,fps=24" -c:v libx264 -preset veryfast -crf 30 -pix_fmt yuv420p -movflags +faststart -an $O/$N-preview.mp4
ffmpeg -v error -y -ss ${5:-1.2} -i $O/$N.mp4 -frames:v 1 -vf "scale=1200:-2" -q:v 3 $O/$N.jpg
ls -la $O/$N* | awk '{print $5, $9}'
