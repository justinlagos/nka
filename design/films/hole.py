# python3 hole.py in.png out.png [recolourHue]  -> RGBA photo with a transparent hole where the magenta screen was.
# Optional: shift magenta reflections elsewhere in the photo to another hue (OpenCV hue 0-180).
import sys, cv2, numpy as np
src, out = sys.argv[1], sys.argv[2]
hue = int(sys.argv[3]) if len(sys.argv) > 3 else None
im = cv2.imread(src).astype(np.float32)
b, g, r = im[..., 0], im[..., 1], im[..., 2]
m = np.clip((np.minimum(r, b) - g - 50) / 70.0, 0, 1)
mask = (m > 0.5).astype(np.uint8)
n, lab, stats, _ = cv2.connectedComponentsWithStats(mask)
big = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
screen = (lab == big).astype(np.uint8)
screen = cv2.morphologyEx(screen, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
near = cv2.dilate(screen, np.ones((9, 9), np.uint8))
alpha = np.ones_like(m)
hole = cv2.dilate(screen, np.ones((3, 3), np.uint8)).astype(np.float32)
soft = np.maximum(hole, m * near)
alpha = 1 - np.clip(soft, 0, 1)
# fringe pixels: darken so no pink halo remains
fr = (near > 0) & (alpha > 0) & (m > 0.05)
im[fr] = im[fr] * 0.25 + np.array([20, 18, 18]) * 0.75
if hue is not None:
    hsv = cv2.cvtColor(np.clip(im, 0, 255).astype(np.uint8), cv2.COLOR_BGR2HSV)
    pink = (hsv[..., 0] > 135) & (hsv[..., 0] < 172) & (hsv[..., 1] > 50) & (near == 0)
    hsv[..., 0][pink] = hue
    im = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR).astype(np.float32)
rgba = np.dstack([np.clip(im, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)])
cv2.imwrite(out, rgba)
print('ok', screen.sum())
