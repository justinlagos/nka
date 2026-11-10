# python3 detect.py in.png out.jpg  -> prints JSON quad of the magenta screen (TL,TR,BR,BL)
import sys, json, cv2, numpy as np
src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src)
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
b, g, r = cv2.split(im.astype(np.int16))
mask = ((r > 150) & (b > 140) & (g < 110) & (r - g > 90) & (b - g > 70)).astype(np.uint8) * 255
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
c = max(cnts, key=cv2.contourArea)
hull = cv2.convexHull(c)
peri = cv2.arcLength(hull, True)
quad = None
for eps in [0.01, 0.015, 0.02, 0.03, 0.04, 0.05]:
    ap = cv2.approxPolyDP(hull, eps * peri, True)
    if len(ap) == 4:
        quad = ap.reshape(4, 2).astype(float); break
if quad is None:
    quad = cv2.boxPoints(cv2.minAreaRect(hull))
s = quad.sum(1); d = np.diff(quad, axis=1).ravel()
tl, br = quad[np.argmin(s)], quad[np.argmax(s)]
tr, bl = quad[np.argmin(d)], quad[np.argmax(d)]
q = np.array([tl, tr, br, bl])
# Paint the screen area dark (and a little beyond) so no magenta bleeds at the edges.
grow = cv2.dilate(mask, np.ones((7, 7), np.uint8))
im[grow > 0] = (18, 16, 16)
cv2.imwrite(out, im, [cv2.IMWRITE_JPEG_QUALITY, 92])
print(json.dumps({"w": im.shape[1], "h": im.shape[0], "quad": q.round(1).tolist(), "area": float(cv2.contourArea(c))}))
