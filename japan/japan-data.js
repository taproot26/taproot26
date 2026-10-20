// Seed data for the Japanese study page.
// Rules are grouped into color-coded sections (mirrors the grammar artifact).
// In-app edits/additions are layered on top of this seed via localStorage (see japan.js).
// Romaji here is treated as source of truth — corrections from old notes are baked in.
// `examples` = extra examples shown in the detail modal when a card is clicked.
// Examples aim to be robust: multiple cases + edge cases (irregulars, casual contractions, exceptions).
window.JAPAN_DATA = {
  sections: [
    { id: 'foundation', label: 'Foundations', color: '#888780' },
    { id: 'causative',  label: 'Causative / passive', color: '#D85A30' },
    { id: 'giving',     label: 'Giving & receiving', color: '#D4537E' },
    { id: 'permission', label: 'Permission / obligation', color: '#1D9E75' },
    { id: 'aspect',     label: 'Aspect / state', color: '#378ADD' },
    { id: 'weird',      label: 'Weird verb groups', color: '#7F77DD' },
    { id: 'irregular',  label: 'Irregular verbs', color: '#639922' },
    { id: 'advanced',   label: 'Advanced', color: '#BA7517' },
  ],

  rules: [
    // Foundations
    { id: 'te-endings', section: 'foundation', pattern: 'て-form endings', gloss: 'う-verb te-form by ending', example: '書く → 書いて', romaji: 'kaku → kaite', translation: 'く→いて, ぐ→いで, す→して, つ/う/る→って, む/ぬ/ぶ→んで', examples: [
      { jp: '泳ぐ → 泳いで', romaji: 'oyogu → oyoide', en: 'to swim (ぐ → いで)' },
      { jp: '貸す → 貸して', romaji: 'kasu → kashite', en: 'to lend (す → して)' },
      { jp: '待つ → 待って', romaji: 'matsu → matte', en: 'to wait (つ → って)' },
      { jp: '遊ぶ → 遊んで', romaji: 'asobu → asonde', en: 'to play (ぶ → んで)' },
      { jp: '死ぬ → 死んで', romaji: 'shinu → shinde', en: 'to die (ぬ → んで)' },
      { jp: '行く → 行って', romaji: 'iku → itte', en: 'EXCEPTION: く but goes to って' },
      { jp: 'する → して / 来る → 来て', romaji: 'shite / kite', en: 'the two irregulars' },
    ] },
    { id: 'tai', section: 'foundation', pattern: 'たい', gloss: 'want to (do)', example: '食べたい', romaji: 'tabetai', translation: 'want to eat', note: 'conjugates like an い-adjective (たくない, たかった, たくて)', examples: [
      { jp: '行きたい', romaji: 'ikitai', en: 'want to go' },
      { jp: '飲みたかった', romaji: 'nomitakatta', en: 'wanted to drink' },
      { jp: '見たくない', romaji: 'mitakunai', en: "don't want to see" },
      { jp: '食べたくて', romaji: 'tabetakute', en: 'wanting to eat (and…) — たくて' },
      { jp: '帰りたがってる', romaji: 'kaeritagatteru', en: '(he) wants to go home (3rd person → たがる)' },
    ] },
    { id: 'teiru', section: 'foundation', pattern: 'ている', gloss: 'ongoing / state', example: '食べている', romaji: 'tabete iru', translation: 'is eating', examples: [
      { jp: '待っている', romaji: 'matte iru', en: 'is waiting' },
      { jp: '食べてる', romaji: 'tabeteru', en: 'is eating (casual — い dropped)' },
      { jp: '食べていない', romaji: 'tabete inai', en: "haven't eaten yet" },
      { jp: '毎日走っている', romaji: 'mainichi hashitte iru', en: 'run every day (habitual)' },
      { jp: '知っている / 知らない', romaji: 'shitte iru / shiranai', en: 'EDGE: "know" is 知っている but "not know" is 知らない' },
    ] },
    { id: 'potential', section: 'foundation', pattern: 'potential', gloss: 'can do', example: '話せる', romaji: 'hanaseru', translation: 'can speak', note: 'う-verb → え-stem + る; る-verb → られる', examples: [
      { jp: '食べられる', romaji: 'taberareru', en: 'can eat (る-verb → られる)' },
      { jp: '行ける', romaji: 'ikeru', en: 'can go' },
      { jp: 'できる', romaji: 'dekiru', en: 'can do (する → できる, irregular)' },
      { jp: '来られる', romaji: 'korareru', en: 'can come (来る, irregular)' },
      { jp: '食べれる', romaji: 'tabereru', en: 'can eat (casual "ら-nuki", drops ら)' },
      { jp: '見える / 聞こえる', romaji: 'mieru / kikoeru', en: 'can see / hear (spontaneous, not regular potential)' },
    ] },
    { id: 'yori-hou', section: 'foundation', pattern: 'AよりBのほうが', gloss: 'B more than A', example: '夏より冬のほうが好き', romaji: 'natsu yori fuyu no hou ga suki', translation: 'like winter more than summer', examples: [
      { jp: '犬より猫のほうが好き', romaji: 'inu yori neko no hou ga suki', en: 'like cats more than dogs' },
      { jp: '今日より明日のほうが忙しい', romaji: 'kyou yori ashita no hou ga isogashii', en: 'busier tomorrow than today' },
      { jp: 'こっちのほうがいい', romaji: 'kocchi no hou ga ii', en: 'this one is better' },
      { jp: 'バスより電車のほうが速い', romaji: 'basu yori densha no hou ga hayai', en: 'the train is faster than the bus' },
    ] },
    { id: 'nai', section: 'foundation', pattern: 'ない', gloss: 'negative (plain)', example: '食べない', romaji: 'tabenai', translation: "don't / won't eat", examples: [
      { jp: '飲まない', romaji: 'nomanai', en: "don't drink" },
      { jp: 'しない', romaji: 'shinai', en: "don't do (する)" },
      { jp: '来ない', romaji: 'konai', en: "won't come (来る)" },
      { jp: 'ある → ない', romaji: 'aru → nai', en: 'EDGE: ある is just ない (not "aranai")' },
      { jp: '分からない', romaji: 'wakaranai', en: "don't understand" },
    ] },
    { id: 'nakatta', section: 'foundation', pattern: 'なかった', gloss: 'past negative (plain)', example: '食べなかった', romaji: 'tabenakatta', translation: "didn't eat", examples: [
      { jp: '行かなかった', romaji: 'ikanakatta', en: "didn't go" },
      { jp: 'できなかった', romaji: 'dekinakatta', en: "couldn't / didn't manage" },
      { jp: 'じゃなかった', romaji: 'ja nakatta', en: "wasn't (noun / na-adj)" },
      { jp: '面白くなかった', romaji: 'omoshirokunakatta', en: "wasn't interesting (い-adj → くなかった)" },
    ] },
    { id: 'masu', section: 'foundation', pattern: 'ます', gloss: 'polite form', example: '食べます', romaji: 'tabemasu', translation: 'eat (polite)', examples: [
      { jp: '飲みます', romaji: 'nomimasu', en: 'drink' },
      { jp: 'します / 来ます', romaji: 'shimasu / kimasu', en: 'do / come (irregular)' },
      { jp: '食べません', romaji: 'tabemasen', en: "don't eat (polite negative)" },
      { jp: '食べました', romaji: 'tabemashita', en: 'ate (polite past)' },
      { jp: '行きませんでした', romaji: 'ikimasen deshita', en: "didn't go (polite past negative)" },
    ] },
    { id: 'volitional', section: 'foundation', pattern: 'よう / おう', gloss: "volitional — let's / I'll", example: '食べよう', romaji: 'tabeyou', translation: "let's eat", examples: [
      { jp: '行こう', romaji: 'ikou', en: "let's go" },
      { jp: '飲もう', romaji: 'nomou', en: "let's drink" },
      { jp: 'しよう / 来よう', romaji: 'shiyou / koyou', en: "let's do / let's come (irregular)" },
      { jp: '食べましょう', romaji: 'tabemashou', en: "let's eat (polite)" },
      { jp: '行こうと思う', romaji: 'ikou to omou', en: "I think I'll go (volitional + と思う)" },
    ] },
    { id: 'sugiru', section: 'foundation', pattern: 'すぎる', gloss: 'too much / over-', example: '食べすぎる', romaji: 'tabesugiru', translation: 'eat too much', note: 'verb ます-stem, or adjective minus い/な, + すぎる', examples: [
      { jp: '高すぎる', romaji: 'takasugiru', en: 'too expensive (い-adj: drop い)' },
      { jp: '飲みすぎた', romaji: 'nomisugita', en: 'drank too much' },
      { jp: '静かすぎる', romaji: 'shizukasugiru', en: 'too quiet (na-adj)' },
      { jp: '可愛すぎる', romaji: 'kawaisugiru', en: 'too cute' },
      { jp: 'なさすぎる', romaji: 'nasasugiru', en: 'EDGE: ない → なさすぎる (too little)' },
    ] },
    { id: 'ku-adverb', section: 'foundation', pattern: 'く (adverb)', gloss: 'い-adjective → adverb', example: '早い → 早く', romaji: 'hayai → hayaku', translation: 'fast → quickly', note: 'na-adjectives use に instead (静かに)', examples: [
      { jp: '美味しく作る', romaji: 'oishiku tsukuru', en: 'cook (it) deliciously' },
      { jp: '優しく', romaji: 'yasashiku', en: 'kindly / gently' },
      { jp: 'いい → よく', romaji: 'ii → yoku', en: 'EDGE: いい becomes よく (irregular), not "iiku"' },
      { jp: '静かに', romaji: 'shizuka ni', en: 'quietly (na-adj uses に, not く)' },
    ] },
    { id: 'hoshii', section: 'foundation', pattern: 'ほしい', gloss: 'want (a thing)', example: '水がほしい', romaji: 'mizu ga hoshii', translation: 'want water', note: 'たい = want to DO; ほしい = want a THING', examples: [
      { jp: '時間がほしい', romaji: 'jikan ga hoshii', en: 'want (more) time' },
      { jp: '来てほしい', romaji: 'kite hoshii', en: 'want (you) to come (てほしい)' },
      { jp: 'ほしくない', romaji: 'hoshikunai', en: "don't want it (い-adj negative)" },
      { jp: '犬をほしがってる', romaji: 'inu wo hoshigatteru', en: '(they) want a dog (3rd person → ほしがる)' },
    ] },
    { id: 'ga-ability', section: 'foundation', pattern: 'が (ability / feeling)', gloss: 'object of can/like/want takes が', example: '日本語が話せる', romaji: 'nihongo ga hanaseru', translation: 'can speak Japanese', examples: [
      { jp: '猫が好き', romaji: 'neko ga suki', en: 'like cats' },
      { jp: '寿司が食べられる', romaji: 'sushi ga taberareru', en: 'can eat sushi' },
      { jp: '意味がわかる', romaji: 'imi ga wakaru', en: 'understand the meaning' },
      { jp: '泳ぎが得意', romaji: 'oyogi ga tokui', en: 'good at swimming' },
    ] },
    { id: 'ko-so-a', section: 'foundation', pattern: 'これ / それ / あれ', gloss: 'this / that / that over there', example: 'これ / それ / あれ', romaji: 'kore / sore / are', translation: 'near me / near you / far from both', examples: [
      { jp: 'この / その / あの + noun', romaji: 'kono / sono / ano', en: 'this ~ / that ~ / that ~ over there' },
      { jp: 'ここ / そこ / あそこ', romaji: 'koko / soko / asoko', en: 'here / there / over there' },
      { jp: 'どれ / どの / どこ', romaji: 'dore / dono / doko', en: 'which / which ~ / where (the ど- question set)' },
      { jp: 'こんな / そんな / あんな', romaji: 'konna / sonna / anna', en: 'this / that kind of' },
    ] },
    { id: 'kara-made', section: 'foundation', pattern: 'から / まで', gloss: 'from/after … until', example: '9時から5時まで', romaji: 'ku-ji kara go-ji made', translation: 'from 9 to 5', examples: [
      { jp: '東京から', romaji: 'Tokyo kara', en: 'from Tokyo' },
      { jp: '終わってから', romaji: 'owatte kara', en: 'after (it) finishes' },
      { jp: '高いから', romaji: 'takai kara', en: "because it's expensive (から = reason too)" },
      { jp: '5時までに', romaji: 'go-ji made ni', en: 'EDGE: by 5 (までに = deadline, vs まで = until)' },
    ] },
    { id: 'to-tte', section: 'foundation', pattern: 'と / って (quote)', gloss: 'marks quoted speech / thought', example: '行くと言った', romaji: 'iku to itta', translation: 'said (they) would go', note: 'と = neutral; って = casual spoken', examples: [
      { jp: 'うんって言った', romaji: 'un tte itta', en: 'said "yeah"' },
      { jp: '無理だと思う', romaji: 'muri da to omou', en: "think it's impossible" },
      { jp: '何て言った？', romaji: 'nante itta?', en: 'what did (you) say?' },
      { jp: '行くって', romaji: 'iku tte', en: '(they) said (they) are going (って drops 言った)' },
      { jp: '田中という人', romaji: 'Tanaka to iu hito', en: 'a person called Tanaka (という)' },
    ] },

    // Causative / passive
    { id: 'saseru', section: 'causative', pattern: 'させる', gloss: 'causative — make/let (someone) do', example: '食べさせる', romaji: 'tabesaseru', translation: 'make (someone) eat', note: 'る-verb: stem + させる', examples: [
      { jp: '行かせる', romaji: 'ikaseru', en: 'make (someone) go' },
      { jp: '待たせる', romaji: 'mataseru', en: 'make (someone) wait' },
      { jp: '勉強させる', romaji: 'benkyou saseru', en: 'make (someone) study' },
      { jp: '行かせてください', romaji: 'ikasete kudasai', en: 'please let me go (させてください = let me)' },
      { jp: '来させる', romaji: 'kosaseru', en: 'make (someone) come (来る, irregular)' },
    ] },
    { id: 'seru', section: 'causative', pattern: 'う-verb causative', gloss: 'あ-stem + せる (not らせる)', example: '怒らせる', romaji: 'okoraseru', translation: 'make (someone) angry', note: '怒る → 怒ら + せる', examples: [
      { jp: '笑わせる', romaji: 'warawaseru', en: 'make (someone) laugh (う → わ)' },
      { jp: '泣かせる', romaji: 'nakaseru', en: 'make (someone) cry' },
      { jp: '困らせる', romaji: 'komaraseru', en: 'trouble / bother someone' },
      { jp: '飲ませる', romaji: 'nomaseru', en: 'make / let (someone) drink' },
      { jp: '待たせる', romaji: 'mataseru', en: 'make (someone) wait (つ → た)' },
    ] },
    { id: 'rareru', section: 'causative', pattern: 'られる', gloss: 'passive — to be (verb)ed', example: '怒られた', romaji: 'okorareta', translation: 'got scolded / was yelled at', note: 'agent marked with に', examples: [
      { jp: '食べられた', romaji: 'taberareta', en: 'was eaten' },
      { jp: '盗まれた', romaji: 'nusumareta', en: 'was stolen' },
      { jp: '先生に褒められた', romaji: 'sensei ni homerareta', en: 'was praised by the teacher (に = by)' },
      { jp: '雨に降られた', romaji: 'ame ni furareta', en: 'EDGE: got rained on (suffering passive)' },
      { jp: '足を踏まれた', romaji: 'ashi wo fumareta', en: 'had my foot stepped on' },
    ] },
    { id: 'saserareru', section: 'causative', pattern: 'させられる', gloss: 'forced to do', example: '食べさせられた', romaji: 'tabesaserareta', translation: 'was forced to eat', examples: [
      { jp: '飲まされた', romaji: 'nomasareta', en: 'was made to drink (short form される)' },
      { jp: '待たされた', romaji: 'matasareta', en: 'was made to wait (short form)' },
      { jp: '働かせられた', romaji: 'hatarakaserareta', en: 'was forced to work' },
      { jp: 'やらされた', romaji: 'yarasareta', en: 'was made to do it' },
    ] },

    // Giving & receiving (やりもらい)
    { id: 'te-ageru', section: 'giving', pattern: 'てあげる', gloss: 'do (for someone else)', example: '教えてあげる', romaji: 'oshiete ageru', translation: 'teach them (for their benefit)', examples: [
      { jp: '作ってあげる', romaji: 'tsukutte ageru', en: 'make it for them' },
      { jp: '貸してあげる', romaji: 'kashite ageru', en: 'lend it to them' },
      { jp: '買ってやる', romaji: 'katte yaru', en: 'buy it for (you) — てやる, rough / to inferiors' },
      { jp: '教えてさしあげる', romaji: 'oshiete sashiageru', en: 'teach (humble / very polite)' },
    ] },
    { id: 'te-kureru', section: 'giving', pattern: 'てくれる', gloss: 'someone does (for me)', example: '教えてくれた', romaji: 'oshiete kureta', translation: 'they taught me', examples: [
      { jp: '手伝ってくれる', romaji: 'tetsudatte kureru', en: 'helps me out' },
      { jp: '教えてくれてありがとう', romaji: 'oshiete kurete arigatou', en: 'thanks for telling me' },
      { jp: '待ってくれ', romaji: 'matte kure', en: 'wait for me (くれ = rough command)' },
      { jp: '来てくださる', romaji: 'kite kudasaru', en: '(they) come (くださる = honorific)' },
    ] },
    { id: 'te-morau', section: 'giving', pattern: 'てもらう', gloss: 'have / get someone to do for you', example: '手伝ってもらう', romaji: 'tetsudatte morau', translation: 'get (someone) to help', examples: [
      { jp: '教えてもらう', romaji: 'oshiete morau', en: 'have someone teach me' },
      { jp: '作ってもらった', romaji: 'tsukutte moratta', en: 'had it made for me' },
      { jp: '教えていただく', romaji: 'oshiete itadaku', en: 'have someone teach (humble)' },
      { jp: '休ませてもらう', romaji: 'yasumasete morau', en: 'get to take time off (させてもらう)' },
    ] },

    // Permission / obligation
    { id: 'te-mo-ii', section: 'permission', pattern: 'てもいい', gloss: 'okay to / can (do)', example: '行ってもいい', romaji: 'itte mo ii', translation: "it's okay to go / can I go?", examples: [
      { jp: '食べてもいい', romaji: 'tabete mo ii', en: 'may eat' },
      { jp: '見てもいい？', romaji: 'mite mo ii?', en: 'can I look?' },
      { jp: '行っていい？', romaji: 'itte ii?', en: 'can I go? (casual, drops も)' },
      { jp: '使ってもかまわない', romaji: 'tsukatte mo kamawanai', en: "don't mind if you use it" },
    ] },
    { id: 'nakute-mo-ii', section: 'permission', pattern: 'なくてもいい', gloss: "don't have to", example: '飲まなくてもいい', romaji: 'nomanakute mo ii', translation: "don't have to drink", examples: [
      { jp: '来なくてもいい', romaji: 'konakute mo ii', en: "don't have to come" },
      { jp: 'しなくてもいい', romaji: 'shinakute mo ii', en: "don't have to do it" },
      { jp: '急がなくていい', romaji: 'isoganakute ii', en: 'no need to hurry (casual, drops も)' },
      { jp: '払わなくてもいい', romaji: 'harawanakute mo ii', en: "don't have to pay" },
      { jp: 'しなくてもよかった', romaji: 'shinakute mo yokatta', en: "didn't have to do it (past → よかった)" },
    ] },
    { id: 'nakya', section: 'permission', pattern: 'なきゃいけない', gloss: 'have to / must', example: '行かなきゃいけない', romaji: 'ikanakya ikenai', translation: 'have to go', examples: [
      { jp: '食べなきゃいけない', romaji: 'tabenakya ikenai', en: 'have to eat' },
      { jp: '寝なきゃ', romaji: 'nenakya', en: 'gotta sleep (casual, いけない dropped)' },
      { jp: '行かなくちゃ', romaji: 'ikanakucha', en: 'gotta go (なくちゃ variant)' },
      { jp: 'しなければならない', romaji: 'shinakereba naranai', en: 'must do (formal full form)' },
    ] },
    { id: 'naide', section: 'permission', pattern: 'ないで', gloss: "please don't (plea)", example: '泣かないで', romaji: 'nakanaide', translation: "don't cry", examples: [
      { jp: '食べないで', romaji: 'tabenaide', en: "don't eat it" },
      { jp: '心配しないで', romaji: 'shinpai shinaide', en: "don't worry" },
      { jp: '触らないでください', romaji: 'sawaranaide kudasai', en: "please don't touch (polite)" },
      { jp: '言わずに', romaji: 'iwazu ni', en: 'without saying (ずに, literary)' },
    ] },
    { id: 'te-wa-ikenai', section: 'permission', pattern: 'てはいけない', gloss: "mustn't (prohibition)", example: '入ってはいけない', romaji: 'haitte wa ikenai', translation: "you mustn't enter", examples: [
      { jp: '食べてはいけない', romaji: 'tabete wa ikenai', en: "mustn't eat" },
      { jp: '遅れてはいけない', romaji: 'okurete wa ikenai', en: "mustn't be late" },
      { jp: '食べちゃだめ', romaji: 'tabecha dame', en: "no eating (ちゃ casual)" },
      { jp: '飲んじゃだめ', romaji: 'nonja dame', en: "no drinking (んじゃ for ぶ/む/ぬ verbs)" },
    ] },
    { id: 'naito', section: 'permission', pattern: 'ないと', gloss: "have to (or else) — casual", example: '食べないと', romaji: 'tabenai to', translation: 'gotta eat', note: 'short for ないといけない; trails off', examples: [
      { jp: '行かないと', romaji: 'ikanai to', en: 'gotta go' },
      { jp: '寝ないと', romaji: 'nenai to', en: 'gotta sleep' },
      { jp: 'しないとだめ', romaji: 'shinai to dame', en: 'gotta do it (ないとだめ)' },
      { jp: '急がないと', romaji: 'isoganai to', en: 'gotta hurry' },
    ] },
    { id: 'nasai', section: 'permission', pattern: 'なさい', gloss: 'firm/gentle command (do it)', example: '食べなさい', romaji: 'tabenasai', translation: 'eat (now)', note: 'parent-to-child / teacher tone; ます-stem + なさい', examples: [
      { jp: '早くしなさい', romaji: 'hayaku shinasai', en: 'hurry up' },
      { jp: '勉強しなさい', romaji: 'benkyou shinasai', en: 'go study' },
      { jp: '見なさい', romaji: 'minasai', en: 'look' },
      { jp: '食べな', romaji: 'tabena', en: 'eat (casual, clipped from なさい)' },
    ] },

    // Aspect / state
    { id: 'te-shimau', section: 'aspect', pattern: 'てしまう / ちゃう', gloss: 'end up doing / finished (often regret)', example: '寝ちゃった', romaji: 'nechatta', translation: 'ended up falling asleep', examples: [
      { jp: '食べちゃった', romaji: 'tabechatta', en: 'ate it all up' },
      { jp: '忘れてしまった', romaji: 'wasurete shimatta', en: 'ended up forgetting' },
      { jp: '言っちゃった', romaji: 'itchatta', en: 'blurted it out' },
      { jp: '飲んじゃう', romaji: 'nonjau', en: 'end up drinking (む → んじゃう)' },
      { jp: '死んじゃった', romaji: 'shinjatta', en: 'died (じゃう for ぬ/ぶ/む verbs)' },
    ] },
    { id: 'te-oku', section: 'aspect', pattern: 'ておく', gloss: 'do in advance', example: '準備しておく', romaji: 'junbi shite oku', translation: 'prepare ahead of time', examples: [
      { jp: '買っておく', romaji: 'katte oku', en: 'buy in advance' },
      { jp: '予約しておく', romaji: 'yoyaku shite oku', en: 'reserve ahead' },
      { jp: 'やっとく', romaji: 'yattoku', en: "I'll do it (casual とく)" },
      { jp: '読んどく', romaji: 'yondoku', en: 'read it beforehand (casual, で → どく)' },
    ] },
    { id: 'te-aru', section: 'aspect', pattern: 'てある', gloss: 'resultant state (someone did it)', example: '窓が開けてある', romaji: 'mado ga akete aru', translation: 'the window has been opened', note: 'transitive verb; implies someone did it on purpose', examples: [
      { jp: '書いてある', romaji: 'kaite aru', en: "it's written (there)" },
      { jp: '貼ってある', romaji: 'hatte aru', en: "it's posted up" },
      { jp: 'ドアが閉めてある', romaji: 'doa ga shimete aru', en: 'the door has been shut (vs 閉まっている = just closed)' },
      { jp: 'もう予約してある', romaji: 'mou yoyaku shite aru', en: "it's already been reserved" },
    ] },
    { id: 'yasui', section: 'aspect', pattern: 'やすい', gloss: 'easy to / tends to', example: '汚れやすい', romaji: 'yogoreyasui', translation: 'gets dirty easily', note: 'ます-stem + やすい; conjugates like an い-adj', examples: [
      { jp: '読みやすい', romaji: 'yomiyasui', en: 'easy to read' },
      { jp: '分かりやすい', romaji: 'wakariyasui', en: 'easy to understand' },
      { jp: '壊れやすい', romaji: 'kowareyasui', en: 'fragile (tends to break)' },
      { jp: '使いやすかった', romaji: 'tsukaiyasukatta', en: 'was easy to use (い-adj past)' },
      { jp: '読みにくい', romaji: 'yominikui', en: 'hard to read (opposite: にくい)' },
    ] },
    { id: 'yori', section: 'aspect', pattern: 'より', gloss: 'comparison — "than"', example: 'りんごより美味しい', romaji: 'ringo yori oishii', translation: 'more delicious than an apple', examples: [
      { jp: '思ったより難しい', romaji: 'omotta yori muzukashii', en: 'harder than I thought' },
      { jp: '昨日より寒い', romaji: 'kinou yori samui', en: 'colder than yesterday' },
      { jp: '予想より早い', romaji: 'yosou yori hayai', en: 'earlier than expected' },
      { jp: '何より大事', romaji: 'nani yori daiji', en: 'more important than anything' },
    ] },
    { id: 'to-omotta', section: 'aspect', pattern: 'と思った', gloss: 'thought that…', example: '来ると思った', romaji: 'kuru to omotta', translation: 'thought (they) would come', examples: [
      { jp: '雨だと思った', romaji: 'ame da to omotta', en: "thought it'd rain" },
      { jp: 'できると思う', romaji: 'dekiru to omou', en: 'think I can do it' },
      { jp: '行くと思ってた', romaji: 'iku to omotteta', en: "thought (they'd) go (casual)" },
      { jp: '行こうと思う', romaji: 'ikou to omou', en: "think I'll go (volitional + と思う)" },
      { jp: 'いいと思わない', romaji: 'ii to omowanai', en: "don't think it's good" },
    ] },
    { id: 'te-kara', section: 'aspect', pattern: 'てから', gloss: 'after doing', example: '食べてから', romaji: 'tabete kara', translation: 'after eating', examples: [
      { jp: '帰ってから', romaji: 'kaette kara', en: 'after getting home' },
      { jp: '考えてから', romaji: 'kangaete kara', en: 'after thinking it over' },
      { jp: '食べてからにして', romaji: 'tabete kara ni shite', en: 'do it after you eat' },
      { jp: '来てから3年', romaji: 'kite kara san-nen', en: '3 years since (I) came (duration since)' },
    ] },
    { id: 'te-miru', section: 'aspect', pattern: 'てみる', gloss: 'try doing (and see)', example: '食べてみる', romaji: 'tabete miru', translation: 'try eating', examples: [
      { jp: 'やってみる', romaji: 'yatte miru', en: 'give it a try' },
      { jp: '食べてみた', romaji: 'tabete mita', en: 'tried eating (and saw how it was)' },
      { jp: '着てみたい', romaji: 'kite mitai', en: 'want to try wearing (てみたい)' },
      { jp: '考えてみて', romaji: 'kangaete mite', en: 'try thinking about it' },
    ] },
    { id: 'te-kuru-iku', section: 'aspect', pattern: 'てくる / ていく', gloss: 'direction / change over time', example: '買ってくる', romaji: 'katte kuru', translation: 'go buy (and come back)', examples: [
      { jp: '歩いていく', romaji: 'aruite iku', en: 'go on foot' },
      { jp: '持ってくる / 持っていく', romaji: 'motte kuru / motte iku', en: 'bring (here) / take (there)' },
      { jp: '増えてきた', romaji: 'fuete kita', en: 'has been increasing (change up to now)' },
      { jp: '寒くなってきた', romaji: 'samuku natte kita', en: "it's been getting cold" },
      { jp: '慣れていく', romaji: 'narete iku', en: 'gradually get used to (change onward)' },
    ] },
    { id: 'nikui', section: 'aspect', pattern: 'にくい', gloss: 'hard to (opposite of やすい)', example: '読みにくい', romaji: 'yominikui', translation: 'hard to read', examples: [
      { jp: '言いにくい', romaji: 'iinikui', en: 'hard to say' },
      { jp: '使いにくい', romaji: 'tsukainikui', en: 'hard to use' },
      { jp: '見えにくい', romaji: 'mienikui', en: 'hard to see' },
      { jp: '言いづらい', romaji: 'iizurai', en: 'hard to say (づらい ≈ synonym, more reluctant)' },
    ] },

    // Weird verb groups
    { id: 'mu-verbs', section: 'weird', pattern: 'む-verbs', gloss: 'む → んで in te-form', example: '飲む → 飲んで', romaji: 'nomu → nonde', translation: 'to drink → drinking', note: 'ぬ and ぶ also go to んで / んだ', examples: [
      { jp: '読む → 読んで', romaji: 'yomu → yonde', en: 'to read' },
      { jp: '住む → 住んで', romaji: 'sumu → sunde', en: 'to live' },
      { jp: '飲む → 飲んだ', romaji: 'nomu → nonda', en: 'past tense → んだ' },
      { jp: '死ぬ → 死んで', romaji: 'shinu → shinde', en: 'ぬ also → んで' },
      { jp: '遊ぶ → 遊んで', romaji: 'asobu → asonde', en: 'ぶ also → んで' },
    ] },
    { id: 'ru-looking', section: 'weird', pattern: 'う-verbs ending in る', gloss: "look like る-verbs, aren't", example: '殴る → 殴らない', romaji: 'naguru → naguranai', translation: "to hit → don't hit", note: 'common ones worth memorizing', examples: [
      { jp: '帰る → 帰って', romaji: 'kaeru → kaette', en: 'to go home (う-verb!)' },
      { jp: '走る → 走って', romaji: 'hashiru → hashitte', en: 'to run' },
      { jp: '要る → 要らない', romaji: 'iru → iranai', en: 'to need' },
      { jp: '切る → 切って', romaji: 'kiru → kitte', en: 'to cut' },
      { jp: '入る → 入って', romaji: 'hairu → haitte', en: 'to enter' },
      { jp: '知る → 知って', romaji: 'shiru → shitte', en: 'to know' },
    ] },
    { id: 'suru-verbs', section: 'weird', pattern: 'する-verbs', gloss: 'conjugate off する (not like う-verbs)', example: '罰する → 罰しない', romaji: 'bassuru → basshinai', translation: "to punish → don't punish", note: 'noun + する makes a verb', examples: [
      { jp: '勉強する → 勉強した', romaji: 'benkyou suru → benkyou shita', en: 'to study → studied' },
      { jp: '愛する → 愛さない', romaji: 'aisuru → aisanai', en: "to love → don't love" },
      { jp: '運転する → 運転して', romaji: 'unten suru → unten shite', en: 'to drive → driving' },
      { jp: '予約する → 予約します', romaji: 'yoyaku suru → yoyaku shimasu', en: 'to reserve → reserve (polite)' },
      { jp: 'する → しよう', romaji: 'suru → shiyou', en: "do → let's do (volitional)" },
    ] },
    { id: 'trans-intrans', section: 'weird', pattern: 'transitive / intransitive', gloss: 'you do it / it happens', example: '壊す / 壊れる', romaji: 'kowasu / kowareru', translation: 'break (it) / break (on its own)', note: 'transitive takes を; intransitive takes が', examples: [
      { jp: '開ける / 開く', romaji: 'akeru / aku', en: 'open (it) / (it) opens' },
      { jp: '閉める / 閉まる', romaji: 'shimeru / shimaru', en: 'close (it) / (it) closes' },
      { jp: '始める / 始まる', romaji: 'hajimeru / hajimaru', en: 'start (it) / (it) starts' },
      { jp: '付ける / 付く', romaji: 'tsukeru / tsuku', en: 'turn on / come on' },
      { jp: '入れる / 入る', romaji: 'ireru / hairu', en: 'put in / go in' },
      { jp: '出す / 出る', romaji: 'dasu / deru', en: 'take out / come out' },
    ] },
    { id: 'kimeru-kimaru', section: 'weird', pattern: '決める / 決まる', gloss: 'decide (active) / be decided', example: '決める / 決まる', romaji: 'kimeru / kimaru', translation: 'to decide / to be decided', examples: [
      { jp: '予定を決める', romaji: 'yotei wo kimeru', en: 'decide a plan (you decide)' },
      { jp: '予定が決まった', romaji: 'yotei ga kimatta', en: 'the plan got decided' },
      { jp: '自分で決める', romaji: 'jibun de kimeru', en: 'decide for myself' },
      { jp: 'もう決まってる', romaji: 'mou kimatteru', en: "it's already decided" },
    ] },
    { id: 'umu-umareru', section: 'weird', pattern: '生む / 生まれる', gloss: 'give birth / be born', example: '生む / 生まれる', romaji: 'umu / umareru', translation: 'to give birth / to be born', examples: [
      { jp: '子供を生む', romaji: 'kodomo wo umu', en: 'give birth to a child' },
      { jp: '東京で生まれた', romaji: 'Tokyo de umareta', en: 'was born in Tokyo' },
      { jp: '赤ちゃんが生まれた', romaji: 'akachan ga umareta', en: 'a baby was born' },
      { jp: '卵を産む', romaji: 'tamago wo umu', en: 'lay an egg (産む variant)' },
    ] },

    // Irregular verbs (the only two) — stem changes, must be memorized
    { id: 'kuru', section: 'irregular', pattern: '来る', gloss: 'to come — irregular', example: '来る → 来ない', romaji: 'kuru → konai', translation: "come → don't come", note: 'one kanji 来, three stem readings: く (dict) / き (polite) / こ (negative)', examples: [
      { jp: '来ない', romaji: 'konai', en: "don't come (こ-stem)" },
      { jp: '来ます', romaji: 'kimasu', en: 'come, polite (き-stem)' },
      { jp: '来た / 来て', romaji: 'kita / kite', en: 'came / come (te-form)' },
      { jp: '来られる', romaji: 'korareru', en: 'can come / passive' },
      { jp: '来させる', romaji: 'kosaseru', en: 'make (someone) come' },
      { jp: '来い', romaji: 'koi', en: 'come! (rough command)' },
    ] },
    { id: 'suru', section: 'irregular', pattern: 'する', gloss: 'to do — irregular', example: 'する → しない', romaji: 'suru → shinai', translation: "do → don't do", note: 'also attaches to nouns: 勉強する, 予約する, メールする', examples: [
      { jp: 'します / した / して', romaji: 'shimasu / shita / shite', en: 'polite / past / te-form' },
      { jp: 'できる', romaji: 'dekiru', en: 'can do (potential)' },
      { jp: 'される', romaji: 'sareru', en: 'be done (passive)' },
      { jp: 'させる', romaji: 'saseru', en: 'make (someone) do (causative)' },
      { jp: 'しろ / しよう', romaji: 'shiro / shiyou', en: "do it! (command) / let's do (volitional)" },
    ] },

    // Advanced (Genki II territory)
    { id: 'cond-tara', section: 'advanced', pattern: 'たら', gloss: 'if / when (then)', example: '食べたら', romaji: 'tabetara', translation: 'if/when (I) eat', note: 'most flexible conditional; = past tense + ら', examples: [
      { jp: '終わったら', romaji: 'owattara', en: "when it's done" },
      { jp: '帰ったら電話して', romaji: 'kaettara denwa shite', en: 'call me when you get back' },
      { jp: '高かったら', romaji: 'takakattara', en: "if it's expensive (い-adj + たら)" },
      { jp: '雨だったら', romaji: 'ame dattara', en: 'if it rains (noun + だったら)' },
      { jp: '食べたら？', romaji: 'tabetara?', en: 'why don\'t you eat? (suggestion)' },
    ] },
    { id: 'cond-ba', section: 'advanced', pattern: 'ば', gloss: 'if (conditional)', example: '行けば', romaji: 'ikeba', translation: 'if (you) go', examples: [
      { jp: '安ければ', romaji: 'yasukereba', en: "if it's cheap (い-adj → ければ)" },
      { jp: 'あれば', romaji: 'areba', en: 'if there is (any)' },
      { jp: '急がなければ', romaji: 'isoganakereba', en: "if (you) don't hurry" },
      { jp: '行けばよかった', romaji: 'ikeba yokatta', en: 'should have gone (ばよかった = regret)' },
    ] },
    { id: 'cond-nara', section: 'advanced', pattern: 'なら', gloss: 'if (given that / as for)', example: '君なら', romaji: 'kimi nara', translation: 'if it were you', note: 'picks up something just said / sets a topic', examples: [
      { jp: '行くなら', romaji: 'iku nara', en: "if you're going (then…)" },
      { jp: '日本語なら', romaji: 'nihongo nara', en: 'as for Japanese…' },
      { jp: '寿司なら新鮮なのがいい', romaji: 'sushi nara shinsen na no ga ii', en: "if it's sushi, fresh is best" },
    ] },
    { id: 'bakarika', section: 'advanced', pattern: 'ばかりか', gloss: 'not only … but also', example: '頭がいいばかりか優しい', romaji: 'atama ga ii bakari ka yasashii', translation: 'not only smart but also kind', examples: [
      { jp: '日本語ばかりか英語も話せる', romaji: 'nihongo bakari ka eigo mo hanaseru', en: 'speaks not only Japanese but English too' },
      { jp: '来ないばかりか連絡もしない', romaji: 'konai bakari ka renraku mo shinai', en: "not only doesn't come, doesn't even call" },
    ] },
    { id: 'nitsurete', section: 'advanced', pattern: 'につれて', gloss: 'as … (changes), so does', example: '時間がたつにつれて', romaji: 'jikan ga tatsu ni tsurete', translation: 'as time passes', examples: [
      { jp: '年を取るにつれて', romaji: 'toshi wo toru ni tsurete', en: 'as you get older' },
      { jp: '読むにつれて面白くなる', romaji: 'yomu ni tsurete omoshiroku naru', en: 'gets more interesting as you read' },
    ] },
    { id: 'mononara', section: 'advanced', pattern: 'ものなら', gloss: "if one could (but likely can't)", example: 'できるものなら', romaji: 'dekiru mono nara', translation: 'if I could (do it)', examples: [
      { jp: '戻れるものなら', romaji: 'modoreru mono nara', en: 'if I could go back' },
      { jp: 'できるものならやってみろ', romaji: 'dekiru mono nara yatte miro', en: 'do it if you can' },
    ] },
    { id: 'karashite', section: 'advanced', pattern: 'からして', gloss: 'judging from / even', example: '見た目からして', romaji: 'mitame kara shite', translation: 'judging from the looks alone', examples: [
      { jp: '名前からして', romaji: 'namae kara shite', en: 'even from the name' },
      { jp: '見た目からして怪しい', romaji: 'mitame kara shite ayashii', en: 'suspicious even from the looks' },
      { jp: '最初からして間違ってる', romaji: 'saisho kara shite machigatteru', en: 'wrong from the very start' },
    ] },
    { id: 'keigo', section: 'advanced', pattern: '敬語', gloss: 'honorific / polite speech', example: '召し上がる', romaji: 'meshiagaru', translation: 'to eat (honorific)', note: 'special verbs replace plain ones; 尊敬語 (honorific) vs 謙譲語 (humble)', examples: [
      { jp: 'いらっしゃる', romaji: 'irassharu', en: 'to be / come / go (honorific)' },
      { jp: 'おっしゃる', romaji: 'ossharu', en: 'to say (honorific)' },
      { jp: 'ご覧になる', romaji: 'goran ni naru', en: 'to look (honorific)' },
      { jp: 'いただく', romaji: 'itadaku', en: 'to receive / eat (humble)' },
      { jp: '伺う', romaji: 'ukagau', en: 'to visit / ask (humble)' },
    ] },
  ],

  // Hand-authored drills (curated, so answers are always correct).
  // answers = accepted responses (kana/kanji + romaji variants); matching is normalized.
  drills: [
    { verb: '飲む', verbRomaji: 'nomu', meaning: 'to drink', target: 'て-form', section: 'weird', answers: ['飲んで', 'のんで', 'nonde'], rule: 'む → んで' },
    { verb: '書く', verbRomaji: 'kaku', meaning: 'to write', target: 'て-form', section: 'foundation', answers: ['書いて', 'かいて', 'kaite'], rule: 'く → いて' },
    { verb: '話す', verbRomaji: 'hanasu', meaning: 'to speak', target: 'potential (can do)', section: 'foundation', answers: ['話せる', 'はなせる', 'hanaseru'], rule: 'う-verb → え-stem + る' },
    { verb: '食べる', verbRomaji: 'taberu', meaning: 'to eat', target: 'causative (make eat)', section: 'causative', answers: ['食べさせる', 'たべさせる', 'tabesaseru'], rule: 'る-verb → stem + させる' },
    { verb: '怒る', verbRomaji: 'okoru', meaning: 'to get angry', target: 'causative (make angry)', section: 'causative', answers: ['怒らせる', 'おこらせる', 'okoraseru'], rule: 'う-verb → あ-stem + せる' },
    { verb: 'する', verbRomaji: 'suru', meaning: 'to do', target: 'passive (be done)', section: 'causative', answers: ['される', 'sareru'], rule: 'する → される' },
    { verb: '行く', verbRomaji: 'iku', meaning: 'to go', target: 'have to (なきゃ)', section: 'permission', answers: ['行かなきゃ', 'いかなきゃ', 'ikanakya'], rule: 'ない-stem + なきゃ' },
    { verb: '泣く', verbRomaji: 'naku', meaning: 'to cry', target: "please don't", section: 'permission', answers: ['泣かないで', 'なかないで', 'nakanaide'], rule: 'ない → ないで' },
    { verb: '寝る', verbRomaji: 'neru', meaning: 'to sleep', target: 'ちゃった (ended up)', section: 'aspect', answers: ['寝ちゃった', 'ねちゃった', 'nechatta'], rule: 'て-form + ちゃった' },
    { verb: '壊す', verbRomaji: 'kowasu', meaning: 'to break (it)', target: 'intransitive pair', section: 'weird', answers: ['壊れる', 'こわれる', 'kowareru'], rule: 'transitive → intransitive' },
  ],
};
