import os
import urllib.request
import urllib.parse
import subprocess
import time

TILES = [
    ('1wan', '一万'), ('2wan', '二万'), ('3wan', '三万'),
    ('4wan', '四万'), ('5wan', '五万'), ('6wan', '六万'),
    ('7wan', '七万'), ('8wan', '八万'), ('9wan', '九万'),
    ('1tiao', '一条'), ('2tiao', '二条'), ('3tiao', '三条'),
    ('4tiao', '四条'), ('5tiao', '五条'), ('6tiao', '六条'),
    ('7tiao', '七条'), ('8tiao', '八条'), ('9tiao', '九条'),
    ('1tong', '一筒'), ('2tong', '二筒'), ('3tong', '三筒'),
    ('4tong', '四筒'), ('5tong', '五筒'), ('6tong', '六筒'),
    ('7tong', '七筒'), ('8tong', '八筒'), ('9tong', '九筒'),
    ('E', '东风'), ('S', '南风'), ('W', '西风'), ('N', '北风'),
    ('C', '红中'), ('F', '发财'), ('B', '白板'),
    ('chi', '吃'), ('peng', '碰'), ('gang', '杠'), ('hu', '胡了'), ('zimo', '自摸')
]

RAW_DIR = '/tmp/mahjong_raw_audio'
os.makedirs(RAW_DIR, exist_ok=True)

OUT_BAZONG = 'public/audio/bazong'
OUT_MENGMEI = 'public/audio/mengmei'
OUT_YUJIE = 'public/audio/yujie'

os.makedirs(OUT_BAZONG, exist_ok=True)
os.makedirs(OUT_MENGMEI, exist_ok=True)
os.makedirs(OUT_YUJIE, exist_ok=True)

headers = {'User-Agent': 'Mozilla/5.0'}

print("Step 1: Downloading raw audio files...")
for key, text in TILES:
    raw_path = os.path.join(RAW_DIR, f"{key}.mp3")
    if not os.path.exists(raw_path):
        q = urllib.parse.quote(text)
        url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={q}&tl=zh-CN&client=tw-ob"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp, open(raw_path, 'wb') as f:
            f.write(resp.read())
        time.sleep(0.08)

print("Step 2: Processing distinct character audio with ffmpeg librubberband...")
for key, text in TILES:
    raw_path = os.path.join(RAW_DIR, f"{key}.mp3")
    
    # 1. 陆霸总 (Deep male baritone: pitch 0.72, tempo 0.95)
    bazong_path = os.path.join(OUT_BAZONG, f"{key}.mp3")
    subprocess.run([
        'ffmpeg', '-y', '-i', raw_path,
        '-filter:a', 'rubberband=pitch=0.72:tempo=0.96',
        bazong_path
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 2. 小萌妹 (Cute energetic anime girl: pitch 1.48, tempo 1.12)
    mengmei_path = os.path.join(OUT_MENGMEI, f"{key}.mp3")
    subprocess.run([
        'ffmpeg', '-y', '-i', raw_path,
        '-filter:a', 'rubberband=pitch=1.48:tempo=1.12',
        mengmei_path
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 3. 飒爽九姐 (Mature crisp female / 御姐: pitch 1.0, tempo 1.05)
    yujie_path = os.path.join(OUT_YUJIE, f"{key}.mp3")
    subprocess.run([
        'ffmpeg', '-y', '-i', raw_path,
        '-filter:a', 'rubberband=pitch=1.02:tempo=1.06',
        yujie_path
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

print("Audio generation complete!")
