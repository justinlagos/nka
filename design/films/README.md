# Hero films

Source for the six films in `public/films`. Each film is an HTML page that draws one frame for any time `t`
through `window.frame(t)`. The work in them is designed here, not generated, so all lettering is real type.

Real-world shots are photos with a solid magenta screen (made in Higgsfield). `detect.py` and `quad.py` find
the screen's corners, `hole.py` cuts it out, and `homog.js` maps the designed screen onto it with a CSS
matrix3d, under the photo, so hands and bezels stay in front.

| File | Film | Length |
| --- | --- | --- |
| f1.html | Halden & Co, brand identity in motion | 14.4s |
| f2.html | Runa, campaign in the real world: key visual, billboard, station screen, posters, social | 14.2s |
| f3.html | Northlight Summit, creative presentation | 13.2s |
| f4.html | Boba Bay, motion and social: photographic cups and fruit, stories, feed sizes, shop screen | 15.6s |
| f5.html | Haulo, website and app | 13s |
| f6.html | The Nka workspace, brief to finished files (product demonstration) | 17s, encoded from 0.5s |

Render (needs Playwright, ffmpeg and the fonts in `package.json` installed next to the pages):

```
node render.js $PWD/f5.html $PWD/f5 13          # frames at 30fps, 1600x900
./encode.sh f5 film-haulo out 5 5.6 4.6          # full mp4, 640px preview loop, poster
node stills.js $PWD/f5.html check.jpg 2,5,9     # contact sheet for checking
node clean.js still.png $PWD/f5.html 11.4        # one frame without captions
```

Fonts: @fontsource-variable archivo, fraunces, inter-tight, manrope, plus-jakarta-sans, fredoka; @fontsource caprasimo, gloock, kalam.

Boba Bay: the cups, fruit, pearls, clouds and logo in `boba/` are transparent cutouts from gpt_image_2_6 images
(background transparent). Every story, feed size and the shop screen is laid out from these, in Fredoka with
Kalam for the script line, so the film and the stills match the key visual. `boba/phone-hole.webp` and
`boba/shop-hole.webp` are the real-world shots with the screen cut out.

Runa: one wordmark (RUNA, Archivo 800, orange) and one headline (Run your city., sentence case) on every piece.
`station-still.html` renders the station photo with the poster in place; `small.html` is the small screen
repainted into that photo.

Motion reel (`public/films/reel-motion.mp4`, 23.5s): cuts from the films above with `reelend.html` as the end card.
It is the hero on the Motion and video service page.

`shot.js` takes a plain screenshot of a page: `node shot.js $PWD/page.html out.png 1600 900`.

Lagos billboard (`public/gallery/billboard-lagos.webp`): street shot made with a magenta billboard, then edited to remove a
motorbike riding against traffic. Nigeria drives on the right in left-hand-drive vehicles: oncoming traffic sits on the left
of the frame and the danfo driver sits on the bus's left. `pocketa-billboard-art.webp` is the ad, flattened and extended to
the board's shape; `billboard-lagos-hole.webp` is the photo with the board cut out. Warp the art into the hole (corners
[392,139] [1106,161] [1106,434] [388,421] in the 2048x1360 photo) with OpenCV and lay the photo on top.

Boba Bay café still: `still-boba-table.js` renders the whole café photo with the story in place.
`render-range.js` re-renders only part of a film after a fix: `node render-range.js $PWD/f4.html $PWD/f4 9.4 12.8`.
