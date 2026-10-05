import json, glob, math, collections, os, sys

D = os.path.dirname(os.path.abspath(__file__))
NAME = {'S': '速攻 speed', 'V': '大牌 big-hand', 'B': '稳健 steady', 'D': '防守 defensive'}
RUN_DIR = sys.argv[1] if len(sys.argv) > 1 else 'style-study-runs'
runs = [json.load(open(f)) for f in glob.glob(f'{RUN_DIR}/*.json')]

def pool(lineups):
    out = collections.defaultdict(lambda: {'per': [], 'seats': 0, 'wins': 0, 'self': 0, 'dealIns': 0, 'fan': 0, 'calls': 0, 'hands': 0})
    hands = draws = 0
    fed = collections.Counter()
    for r in runs:
        if r['lineup'] not in lineups:
            continue
        hands += r['hands']; draws += r['draws']
        fed.update(r['fedBy'])
        for k, a in r['acc'].items():
            o = out[k]
            o['per'] += a['perMatch']
            for f in ('seats', 'wins', 'self', 'dealIns', 'fan', 'calls', 'hands'):
                o[f] += a[f]
    return out, hands, draws, fed

def stats(o):
    per = o['per']; n = len(per); m = sum(per) / n
    sd = math.sqrt(sum((x - m) ** 2 for x in per) / (n - 1))
    h16 = lambda x: 16 * x / o['hands']
    return dict(n=n, mean=m, se=sd / math.sqrt(n), wins=h16(o['wins']), dealins=h16(o['dealIns']),
                fanwin=o['fan'] / max(1, o['wins']), selfpct=100 * o['self'] / max(1, o['wins']), calls=h16(o['calls']))

def row(k, s):
    return f"{NAME[k]:<16} {s['mean']:+7.1f} ±{1.96*s['se']:4.1f}   {s['wins']:5.2f}   {s['dealins']:5.2f}   {s['fanwin']:4.2f}   {s['selfpct']:5.1f}%   {s['calls']:5.1f}"

HDR = f"{'style':<16} {'pts/match':>9} (95%)  win/16 dealin/16 fan/win selfdraw  calls/16"

print('=== 1. One of each style (SVBD) ===')
o, hands, draws, fed = pool({'SVBD'})
print(f'{len(o["S"]["per"])} matches, {hands} hands, draws {100*draws/hands:.1f}%')
print(HDR)
for k in sorted(o, key=lambda k: -stats(o[k])['mean']):
    print(row(k, stats(o[k])))
n = len(o['S']['per'])
print('\nWho pays whom (discard wins per match; row = payer, col = winner):')
print('payer \\ winner   ' + ''.join(f'{NAME[w][:2]:>8}' for w in 'SVBD') + '   total')
for p in 'SVBD':
    vals = [fed.get(f'{w}<-{p}', 0) / n for w in 'SVBD']
    print(f'{NAME[p]:<16} ' + ''.join(f'{v:8.2f}' for v in vals) + f'   {sum(vals):5.2f}')

print('\n=== 2. Two vs two (both seatings pooled: partners together and alternating) ===')
for pair in ['BS', 'BV', 'BD', 'SV', 'SD', 'VD']:
    a, b = pair
    o, hands, draws, _ = pool({a + b + a + b, a + a + b + b})
    sa, sb = stats(o[a]), stats(o[b])
    print(f'2×{NAME[a]} vs 2×{NAME[b]}: {sa["n"]} matches, draws {100*draws/hands:.1f}%')
    print('   ' + HDR)
    print('   ' + row(a, sa)); print('   ' + row(b, sb))
    # split by seating
    for lu, label in ((a + b + a + b, 'alternating'), (a + a + b + b, 'together  ')):
        oo, _, _, _ = pool({lu})
        print(f'     {label}: {NAME[a]} {stats(oo[a])["mean"]:+6.1f} ±{1.96*stats(oo[a])["se"]:.1f}')

print('\n=== 3. One vs three ===')
for x in 'SVD':
    for lu, hero in (('B' + x * 3, 'B'), (x + 'BBB', x)):
        o, hands, draws, _ = pool({lu})
        s = stats(o[hero])
        others = 'B' if hero != 'B' else x
        print(f'1×{NAME[hero]} vs 3×{NAME[others]}: {s["mean"]:+6.1f} ±{1.96*s["se"]:.1f} per match  (win/16 {s["wins"]:.2f}, dealin/16 {s["dealins"]:.2f}, fan/win {s["fanwin"]:.2f})')
