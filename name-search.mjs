const MULTI_CHARACTER_READINGS = [
  ["佐々木", "ささき"],
  ["田中", "たなか"],
  ["佐藤", "さとう"],
  ["鈴木", "すずき"],
  ["高橋", "たかはし"],
  ["渡辺", "わたなべ"],
  ["伊藤", "いとう"],
  ["山本", "やまもと"],
  ["中村", "なかむら"],
  ["小林", "こばやし"],
  ["加藤", "かとう"],
  ["吉田", "よしだ"],
  ["山田", "やまだ"],
  ["山口", "やまぐち"],
  ["松本", "まつもと"],
  ["井上", "いのうえ"],
  ["木村", "きむら"],
  ["斎藤", "さいとう"],
  ["清水", "しみず"],
  ["橋本", "はしもと"],
  ["石川", "いしかわ"],
  ["中島", "なかじま"],
  ["前田", "まえだ"],
  ["藤田", "ふじた"],
  ["後藤", "ごとう"],
  ["岡田", "おかだ"],
  ["長谷川", "はせがわ"],
  ["村上", "むらかみ"],
  ["近藤", "こんどう"],
  ["石井", "いしい"],
  ["坂本", "さかもと"],
  ["遠藤", "えんどう"],
  ["青木", "あおき"],
  ["藤井", "ふじい"],
  ["西村", "にしむら"],
  ["福田", "ふくだ"],
  ["太田", "おおた"],
  ["三浦", "みうら"],
  ["藤原", "ふじわら"],
  ["岡本", "おかもと"],
  ["松田", "まつだ"],
  ["中川", "なかがわ"],
  ["中野", "なかの"],
  ["原田", "はらだ"],
  ["小野", "おの"],
  ["田村", "たむら"],
  ["竹内", "たけうち"],
  ["金子", "かねこ"],
  ["和田", "わだ"],
  ["中山", "なかやま"],
  ["藤本", "ふじもと"],
  ["上田", "うえだ"],
  ["高木", "たかぎ"],
  ["安藤", "あんどう"],
  ["島田", "しまだ"],
  ["工藤", "くどう"],
  ["宮崎", "みやざき"],
  ["酒井", "さかい"],
  ["太郎", "たろう"],
  ["花子", "はなこ"],
  ["美咲", "みさき"],
  ["陽菜", "ひな"],
  ["優奈", "ゆうな"],
  ["結菜", "ゆいな"],
  ["大翔", "ひろと"],
  ["大和", "やまと"],
  ["拓海", "たくみ"],
  ["健太", "けんた"],
].sort((a, b) => b[0].length - a[0].length);

const SINGLE_CHARACTER_READINGS = new Map([
  ["田", "た"],
  ["中", "なか"],
  ["山", "やま"],
  ["川", "かわ"],
  ["本", "もと"],
  ["村", "むら"],
  ["林", "はやし"],
  ["森", "もり"],
  ["原", "はら"],
  ["口", "ぐち"],
  ["橋", "はし"],
  ["石", "いし"],
  ["島", "しま"],
  ["崎", "ざき"],
  ["藤", "とう"],
  ["井", "い"],
  ["上", "うえ"],
  ["下", "した"],
  ["野", "の"],
  ["宮", "みや"],
  ["木", "き"],
  ["清", "し"],
  ["水", "みず"],
  ["近", "こん"],
  ["遠", "えん"],
  ["和", "わ"],
  ["安", "あん"],
  ["工", "く"],
  ["酒", "さか"],
  ["春", "はる"],
  ["陽", "はる"],
  ["晴", "はる"],
  ["遥", "はる"],
  ["花", "はな"],
  ["華", "はな"],
  ["葵", "あおい"],
  ["青", "あお"],
  ["碧", "あお"],
  ["健", "けん"],
  ["賢", "けん"],
  ["太", "た"],
  ["郎", "ろう"],
  ["子", "こ"],
  ["美", "み"],
  ["咲", "さき"],
  ["優", "ゆう"],
  ["奈", "な"],
  ["結", "ゆい"],
  ["菜", "な"],
  ["翔", "しょう"],
  ["大", "だい"],
  ["拓", "たく"],
  ["海", "み"],
]);

const IGNORED_CHARACTERS = new Set(["・", "･", "-", "―", "‐", "_", "(", ")", " "]);

export function matchesPersonSearch({
  query,
  name,
  alias = "",
  aliasCode = "",
  kana = "",
}) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  return buildSearchTargets({ name, alias, aliasCode, kana }).some((target) => target.includes(normalizedQuery));
}

function buildSearchTargets({ name, alias, aliasCode, kana }) {
  return [
    normalizeSearchText(name),
    normalizeSearchText(alias),
    normalizeSearchText(aliasCode),
    normalizeSearchText(kana),
    normalizeSearchText(estimateKana(name)),
  ].filter(Boolean);
}

function estimateKana(value = "") {
  const normalized = value.normalize("NFKC");
  let index = 0;
  let result = "";

  while (index < normalized.length) {
    const phraseMatch = MULTI_CHARACTER_READINGS.find(([kanji]) => normalized.startsWith(kanji, index));
    if (phraseMatch) {
      result += phraseMatch[1];
      index += phraseMatch[0].length;
      continue;
    }

    const current = normalized[index];
    if (/\s/.test(current) || IGNORED_CHARACTERS.has(current)) {
      index += 1;
      continue;
    }
    if (isHiragana(current)) {
      result += current;
      index += 1;
      continue;
    }
    if (isKatakana(current)) {
      result += String.fromCharCode(current.charCodeAt(0) - 0x60);
      index += 1;
      continue;
    }
    if (/[a-z0-9]/i.test(current)) {
      result += current.toLowerCase();
      index += 1;
      continue;
    }

    result += SINGLE_CHARACTER_READINGS.get(current) ?? "";
    index += 1;
  }

  return result;
}

function normalizeSearchText(value = "") {
  const normalized = value.normalize("NFKC").toLowerCase();
  let result = "";
  for (const current of normalized) {
    if (/\s/.test(current) || IGNORED_CHARACTERS.has(current)) continue;
    if (isKatakana(current)) {
      result += String.fromCharCode(current.charCodeAt(0) - 0x60);
      continue;
    }
    result += current;
  }
  return result;
}

function isHiragana(value) {
  return value >= "ぁ" && value <= "ゖ";
}

function isKatakana(value) {
  return value >= "ァ" && value <= "ヶ";
}
