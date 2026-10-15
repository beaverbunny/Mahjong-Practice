/**
 * Voice announcement tests: the 普 (Mandarin, default) setting must speak exactly as it did before
 * the 普/粤 toggle existed (lang zh-CN, first Chinese voice on the device), and 粤 may only switch
 * to a Cantonese voice when the device has one.
 *
 *   bun test scripts/
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

type FakeVoice = { name: string; lang: string };
type Spoken = { text: string; lang: string; voice: FakeVoice | null };

// Voice lists as Chrome reports them on common setups
const MAC: FakeVoice[] = [
  { name: 'Samantha', lang: 'en-US' },
  { name: 'Meijia', lang: 'zh-TW' },
  { name: 'Sinji', lang: 'zh-HK' },
  { name: 'Tingting', lang: 'zh-CN' },
  { name: 'Google US English', lang: 'en-US' },
  { name: 'Google 普通话（中国大陆）', lang: 'zh-CN' },
  { name: 'Google 粤語（香港）', lang: 'zh-HK' },
  { name: 'Google 國語（臺灣）', lang: 'zh-TW' },
];
const WINDOWS: FakeVoice[] = [
  { name: 'Microsoft David - English (United States)', lang: 'en-US' },
  { name: 'Microsoft Huihui - Chinese (Simplified, PRC)', lang: 'zh-CN' },
  { name: 'Microsoft Tracy - Chinese (Traditional, Hong Kong S.A.R.)', lang: 'zh-HK' },
  { name: 'Google US English', lang: 'en-US' },
  { name: 'Google 普通话（中国大陆）', lang: 'zh-CN' },
  { name: 'Google 粤語（香港）', lang: 'zh-HK' },
];
const GOOGLE_ONLY: FakeVoice[] = [
  { name: 'Google US English', lang: 'en-US' },
  { name: 'Google 日本語', lang: 'ja-JP' },
  { name: 'Google 普通话（中国大陆）', lang: 'zh-CN' },
  { name: 'Google 粤語（香港）', lang: 'zh-HK' },
  { name: 'Google 國語（臺灣）', lang: 'zh-TW' },
];
const NO_CANTONESE: FakeVoice[] = [
  { name: 'Samantha', lang: 'en-US' },
  { name: 'Tingting', lang: 'zh-CN' },
];
const SETUPS: Record<string, FakeVoice[]> = { MAC, WINDOWS, GOOGLE_ONLY, NO_CANTONESE, NOT_LOADED: [] };

// The voice choice from before the toggle: lang zh-CN and the first Chinese voice, if any
const before = (voices: FakeVoice[]) => ({
  lang: 'zh-CN',
  voice: voices.find((v) => v.lang.startsWith('zh') || v.lang.includes('cmn')) ?? null,
});

let voices: FakeVoice[] = [];
const spoken: Spoken[] = [];
const synth = {
  getVoices: () => voices,
  cancel: () => {},
  speak: (u: Spoken) => spoken.push({ text: u.text, lang: u.lang, voice: u.voice }),
  onvoiceschanged: null as null | (() => void),
};
class FakeUtterance {
  lang = '';
  voice: FakeVoice | null = null;
  volume = 1;
  pitch = 1;
  rate = 1;
  constructor(public text: string) {}
}

let audio: typeof import('../src/utils/audio');
const g = globalThis as Record<string, unknown>;

beforeAll(async () => {
  g.window = { speechSynthesis: synth };
  g.SpeechSynthesisUtterance = FakeUtterance;
  audio = await import('../src/utils/audio');
});
afterAll(() => {
  delete g.window;
  delete g.SpeechSynthesisUtterance;
});

// Load a device's voices the way Chrome does (voiceschanged), then speak once
function say(list: FakeVoice[], lang: 'cmn' | 'yue', text = '碰'): Spoken {
  voices = list;
  synth.onvoiceschanged?.();
  audio.soundManager.voiceLang = lang;
  audio.soundManager.speak(text);
  return spoken[spoken.length - 1];
}

describe('普 (Mandarin) is unchanged', () => {
  test('default setting is Mandarin', () => {
    expect(audio.soundManager.voiceLang).toBe('cmn');
  });

  for (const [name, list] of Object.entries(SETUPS)) {
    test(`${name}: same lang and voice as before the toggle`, () => {
      const s = say(list, 'cmn');
      expect({ lang: s.lang, voice: s.voice }).toEqual(before(list));
    });
  }

  test('switching to 粤 and back leaves Mandarin as before', () => {
    say(MAC, 'yue');
    const s = say(MAC, 'cmn');
    expect({ lang: s.lang, voice: s.voice }).toEqual(before(MAC));
  });

  test('spoken tile names are simplified, as before', () => {
    const names = ['1tiao', '9tiao', '3wan', '5tong', 'wind_E', 'wind_N', 'dragon_C', 'dragon_F', 'dragon_B'].map((type) =>
      audio.getTileSpokenName({ type })
    );
    expect(names).toEqual(['幺鸡', '九条', '三万', '五筒', '东风', '北风', '红中', '发财', '白板']);
  });
});

describe('粤 (Cantonese) is additive', () => {
  for (const name of ['MAC', 'WINDOWS', 'GOOGLE_ONLY']) {
    test(`${name}: uses the first Cantonese voice`, () => {
      const list = SETUPS[name];
      const s = say(list, 'yue');
      expect(s.voice).toEqual(list.find((v) => v.lang === 'zh-HK') ?? null);
      expect(s.lang).toBe('zh-HK');
    });
  }

  for (const name of ['NO_CANTONESE', 'NOT_LOADED']) {
    test(`${name}: falls back to the Mandarin choice`, () => {
      const list = SETUPS[name];
      const s = say(list, 'yue');
      expect({ lang: s.lang, voice: s.voice }).toEqual(before(list));
    });
  }
});
