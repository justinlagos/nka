# python3 quad.py hole.png  -> refined screen quad (TL,TR,BR,BL) from the transparent hole, by fitting a line to each edge
import sys, json, itertools, numpy as np, cv2
from PIL import Image
A = np.array(Image.open(sys.argv[1]).split()[3])
m = (A < 128).astype(np.uint8)
n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
k = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA]); m = (lab == k).astype(np.uint8)
cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); c = max(cs, key=cv2.contourArea)[:, 0, :].astype(float)
hull = cv2.convexHull(c.astype(np.float32))[:, 0, :]
if len(hull) > 80: hull = hull[np.linspace(0, len(hull) - 1, 80).astype(int)]
best, bq = 0, None
for q in itertools.combinations(range(len(hull)), 4):
    P = hull[list(q)]; x, y = P[:, 0], P[:, 1]
    a = 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))
    if a > best: best, bq = a, P
P = bq; cen = P.mean(0)
ang = np.arctan2(P[:, 1] - cen[1], P[:, 0] - cen[0]); P = P[np.argsort(ang)]  # clockwise from left-top-ish in image coords
s = P.sum(1); i0 = np.argmin(s); P = np.roll(P, -i0, 0)  # start at TL
lines = []
for i in range(4):
    a, b = P[i], P[(i + 1) % 4]; d = b - a; L = np.linalg.norm(d); u = d / L; nrm = np.array([-u[1], u[0]])
    t = (c - a) @ u; dist = np.abs((c - a) @ nrm)
    sel = c[(t > .12 * L) & (t < .88 * L) & (dist < 0.02 * L + 4)]
    vx, vy, x0, y0 = cv2.fitLine(sel.astype(np.float32), cv2.DIST_HUBER, 0, .01, .01).ravel()
    lines.append((np.array([x0, y0]), np.array([vx, vy])))
Q = []
for i in range(4):
    (p1, d1), (p2, d2) = lines[i - 1], lines[i]
    M = np.array([d1, -d2]).T; ts = np.linalg.solve(M, p2 - p1); Q.append(p1 + ts[0] * d1)
Q = np.array(Q); cen = Q.mean(0); Q = cen + (Q - cen) * float(sys.argv[2] if len(sys.argv) > 2 else 1.006)
print(json.dumps([[int(round(x)), int(round(y))] for x, y in Q]))
