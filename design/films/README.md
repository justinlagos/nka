# Hero films

Source for the six films in `public/films`. Each film is an HTML page that draws one frame for any time `t`
through `window.frame(t)`. The work in them is designed here, not generated, so all lettering is real type.

Real-world shots are photos with a solid magenta screen (made in Higgsfield). `detect.py` and `quad.py` find
the screen's corners, `hole.py` cuts it out, and `homog.js` maps the designed screen onto it with a CSS
matrix3d, under the photo, so hands and bezels stay in front.

| File | Film | Length |
| --- | --- | --- |
| f1.html | Halden & Co, brand identity in motion | 14.4s |
| f2.html | Runa, campaign in the real world | 14.2s |
| f3.html | Northlight Summit, creative presentation | 13.2s |
| f4.html | Boba Bay, motion and social | 11.8s |
| f5.html | Haulo, website and app | 13s |
| f6.html | The Nka workspace, brief to finished files (product demonstration) | 17s, encoded from 0.5s |

Render (needs Playwright, ffmpeg and the fonts in `package.json` installed next to the pages):

```
node render.js $PWD/f5.html $PWD/f5 13          # frames at 30fps, 1600x900
./encode.sh f5 film-haulo out 5 5.6 4.6          # full mp4, 640px preview loop, poster
node stills.js $PWD/f5.html check.jpg 2,5,9     # contact sheet for checking
node clean.js still.png $PWD/f5.html 11.4        # one frame without captions
```

Fonts: @fontsource-variable archivo, fraunces, inter-tight, manrope, plus-jakarta-sans; @fontsource caprasimo.
