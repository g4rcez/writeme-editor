import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";

const EmojiSuggestionKey = new PluginKey("emojiSuggestion");
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { updatePosition } from "@/app/extensions/update-position";

const EMOJI_GRID_COLUMNS = 4;

type EmojiItem = {
  emoji: string;
  name: string;
  keywords: string[];
};

const EMOJIS: EmojiItem[] = [
  // Smileys
  { emoji: "😀", name: "grinning", keywords: ["smile", "happy", "grin"] },
  { emoji: "😃", name: "smiley", keywords: ["smile", "happy", "joy"] },
  { emoji: "😄", name: "smile", keywords: ["smile", "happy", "joy"] },
  { emoji: "😁", name: "beaming", keywords: ["smile", "happy", "grin"] },
  { emoji: "😆", name: "laughing", keywords: ["laugh", "happy", "lol"] },
  { emoji: "😅", name: "sweat smile", keywords: ["laugh", "sweat", "nervous"] },
  { emoji: "🤣", name: "rofl", keywords: ["laugh", "lol", "rolling"] },
  { emoji: "😂", name: "joy", keywords: ["laugh", "cry", "tears", "lol"] },
  { emoji: "🙂", name: "slightly smiling", keywords: ["smile", "happy"] },
  { emoji: "🙃", name: "upside down", keywords: ["silly", "joking"] },
  { emoji: "😉", name: "winking", keywords: ["wink", "flirt"] },
  { emoji: "😊", name: "blush", keywords: ["smile", "blush", "happy"] },
  { emoji: "😇", name: "halo", keywords: ["angel", "innocent", "good"] },
  {
    emoji: "🥰",
    name: "smiling hearts",
    keywords: ["love", "hearts", "adore"],
  },
  { emoji: "😍", name: "heart eyes", keywords: ["love", "heart", "adore"] },
  { emoji: "🤩", name: "star struck", keywords: ["wow", "star", "amazing"] },
  { emoji: "😘", name: "kiss", keywords: ["kiss", "love", "heart"] },
  { emoji: "😗", name: "kissing", keywords: ["kiss"] },
  { emoji: "😚", name: "kissing closed eyes", keywords: ["kiss", "love"] },
  { emoji: "😙", name: "kissing smiling eyes", keywords: ["kiss", "smile"] },
  { emoji: "🥲", name: "smiling tear", keywords: ["happy", "sad", "tear"] },
  { emoji: "😋", name: "yum", keywords: ["yum", "delicious", "food"] },
  { emoji: "😛", name: "tongue", keywords: ["tongue", "silly"] },
  {
    emoji: "😜",
    name: "winking tongue",
    keywords: ["tongue", "wink", "silly"],
  },
  { emoji: "🤪", name: "zany", keywords: ["crazy", "silly", "wild"] },
  { emoji: "😝", name: "squinting tongue", keywords: ["tongue", "disgusted"] },
  { emoji: "🤑", name: "money mouth", keywords: ["money", "rich", "dollar"] },
  { emoji: "🤗", name: "hugging", keywords: ["hug", "warm", "friendly"] },
  { emoji: "🤭", name: "hand over mouth", keywords: ["oops", "secret"] },
  { emoji: "🤫", name: "shushing", keywords: ["shush", "quiet", "secret"] },
  { emoji: "🤔", name: "thinking", keywords: ["think", "hmm", "ponder"] },
  {
    emoji: "🤐",
    name: "zipper mouth",
    keywords: ["quiet", "secret", "silent"],
  },
  {
    emoji: "🤨",
    name: "raised eyebrow",
    keywords: ["suspicious", "skeptical"],
  },
  {
    emoji: "😐",
    name: "neutral",
    keywords: ["neutral", "meh", "expressionless"],
  },
  { emoji: "😑", name: "expressionless", keywords: ["blank", "meh", "bored"] },
  { emoji: "😶", name: "no mouth", keywords: ["silent", "quiet"] },
  { emoji: "😏", name: "smirk", keywords: ["smirk", "sly", "smug"] },
  { emoji: "😒", name: "unamused", keywords: ["unamused", "annoyed", "bored"] },
  { emoji: "🙄", name: "eye roll", keywords: ["roll", "annoyed", "whatever"] },
  { emoji: "😬", name: "grimace", keywords: ["grimace", "awkward", "nervous"] },
  { emoji: "🤥", name: "lying", keywords: ["lie", "pinocchio"] },
  { emoji: "😔", name: "pensive", keywords: ["sad", "pensive", "dejected"] },
  { emoji: "😪", name: "sleepy", keywords: ["sleep", "tired", "zzz"] },
  { emoji: "🤤", name: "drooling", keywords: ["drool", "food", "yum"] },
  { emoji: "😴", name: "sleeping", keywords: ["sleep", "zzz", "tired"] },
  { emoji: "😷", name: "mask", keywords: ["sick", "mask", "medical"] },
  { emoji: "🤒", name: "thermometer face", keywords: ["sick", "ill", "fever"] },
  { emoji: "🤕", name: "head bandage", keywords: ["hurt", "injured", "ouch"] },
  { emoji: "🤢", name: "nauseated", keywords: ["sick", "nausea", "gross"] },
  { emoji: "🤮", name: "vomiting", keywords: ["sick", "vomit", "gross"] },
  { emoji: "🤧", name: "sneezing", keywords: ["sneeze", "sick", "cold"] },
  { emoji: "🥵", name: "hot face", keywords: ["hot", "sweat", "heat"] },
  { emoji: "🥶", name: "cold face", keywords: ["cold", "freeze", "shiver"] },
  { emoji: "😵", name: "dizzy", keywords: ["dizzy", "confused", "spiral"] },
  {
    emoji: "🤯",
    name: "exploding head",
    keywords: ["mindblown", "shocked", "wow"],
  },
  { emoji: "🥳", name: "partying", keywords: ["party", "celebrate", "fun"] },
  {
    emoji: "😎",
    name: "sunglasses",
    keywords: ["cool", "sunglasses", "awesome"],
  },
  { emoji: "🤓", name: "nerd", keywords: ["nerd", "geek", "glasses"] },
  { emoji: "🧐", name: "monocle", keywords: ["hmm", "curious", "suspicious"] },
  { emoji: "😕", name: "confused", keywords: ["confused", "hmm", "puzzled"] },
  { emoji: "😟", name: "worried", keywords: ["worried", "concerned", "sad"] },
  {
    emoji: "🙁",
    name: "slightly frowning",
    keywords: ["sad", "frown", "unhappy"],
  },
  {
    emoji: "😮",
    name: "open mouth",
    keywords: ["surprised", "wow", "shocked"],
  },
  { emoji: "😯", name: "hushed", keywords: ["surprised", "shocked", "quiet"] },
  { emoji: "😲", name: "astonished", keywords: ["shocked", "wow", "amazed"] },
  {
    emoji: "😳",
    name: "flushed",
    keywords: ["blush", "embarrassed", "shocked"],
  },
  { emoji: "🥺", name: "pleading", keywords: ["please", "puppy eyes", "beg"] },
  { emoji: "😦", name: "frowning open", keywords: ["frown", "sad", "worried"] },
  { emoji: "😧", name: "anguished", keywords: ["sad", "anguish", "shock"] },
  { emoji: "😨", name: "fearful", keywords: ["fear", "scared", "afraid"] },
  {
    emoji: "😰",
    name: "anxious sweat",
    keywords: ["anxious", "sweat", "nervous"],
  },
  { emoji: "😥", name: "sad relieved", keywords: ["sad", "relieved", "sweat"] },
  { emoji: "😢", name: "cry", keywords: ["cry", "tear", "sad"] },
  {
    emoji: "😭",
    name: "loudly crying",
    keywords: ["cry", "sob", "sad", "tears"],
  },
  { emoji: "😱", name: "screaming", keywords: ["scream", "shock", "scared"] },
  { emoji: "😖", name: "confounded", keywords: ["confused", "frustrated"] },
  { emoji: "😣", name: "persevering", keywords: ["struggle", "persevere"] },
  { emoji: "😞", name: "disappointed", keywords: ["sad", "disappointed"] },
  { emoji: "😓", name: "downcast sweat", keywords: ["sad", "sweat", "tired"] },
  { emoji: "😩", name: "weary", keywords: ["tired", "weary", "frustrated"] },
  { emoji: "😫", name: "tired", keywords: ["tired", "exhausted", "weary"] },
  { emoji: "🥱", name: "yawning", keywords: ["yawn", "tired", "bored"] },
  {
    emoji: "😤",
    name: "steam nose",
    keywords: ["angry", "frustrated", "steam"],
  },
  { emoji: "😡", name: "pouting", keywords: ["angry", "mad", "pout"] },
  { emoji: "😠", name: "angry", keywords: ["angry", "mad", "annoyed"] },
  { emoji: "🤬", name: "symbols mouth", keywords: ["angry", "cursing", "mad"] },
  { emoji: "👿", name: "imp", keywords: ["devil", "evil", "angry"] },
  { emoji: "💀", name: "skull", keywords: ["skull", "dead", "death"] },
  {
    emoji: "☠️",
    name: "skull crossbones",
    keywords: ["danger", "poison", "dead"],
  },
  { emoji: "💩", name: "poop", keywords: ["poop", "poo", "funny"] },
  { emoji: "🤡", name: "clown", keywords: ["clown", "funny", "silly"] },
  { emoji: "👹", name: "ogre", keywords: ["monster", "ogre", "demon"] },
  { emoji: "👺", name: "goblin", keywords: ["goblin", "demon", "monster"] },
  { emoji: "👻", name: "ghost", keywords: ["ghost", "halloween", "boo"] },
  { emoji: "👽", name: "alien", keywords: ["alien", "ufo", "space"] },
  { emoji: "👾", name: "space invader", keywords: ["alien", "game", "pixel"] },
  { emoji: "🤖", name: "robot", keywords: ["robot", "bot", "ai"] },
  // Gestures & People
  { emoji: "👋", name: "wave", keywords: ["wave", "hello", "bye"] },
  { emoji: "🤚", name: "raised back hand", keywords: ["hand", "stop", "hi"] },
  { emoji: "✋", name: "raised hand", keywords: ["hand", "stop", "high five"] },
  { emoji: "🖐️", name: "splayed hand", keywords: ["hand", "five"] },
  { emoji: "👌", name: "ok hand", keywords: ["ok", "perfect", "good"] },
  { emoji: "🤌", name: "pinched fingers", keywords: ["italian", "gesture"] },
  { emoji: "✌️", name: "victory", keywords: ["peace", "victory", "two"] },
  {
    emoji: "🤞",
    name: "crossed fingers",
    keywords: ["luck", "hope", "fingers"],
  },
  { emoji: "🤟", name: "love you gesture", keywords: ["love", "rock", "sign"] },
  { emoji: "🤘", name: "rock on", keywords: ["rock", "metal", "horns"] },
  { emoji: "👈", name: "point left", keywords: ["point", "left", "direction"] },
  {
    emoji: "👉",
    name: "point right",
    keywords: ["point", "right", "direction"],
  },
  { emoji: "👆", name: "point up", keywords: ["point", "up", "above"] },
  { emoji: "👇", name: "point down", keywords: ["point", "down", "below"] },
  { emoji: "☝️", name: "index up", keywords: ["point", "up", "one"] },
  {
    emoji: "👍",
    name: "thumbs up",
    keywords: ["thumbs", "up", "good", "like"],
  },
  {
    emoji: "👎",
    name: "thumbs down",
    keywords: ["thumbs", "down", "bad", "dislike"],
  },
  { emoji: "✊", name: "fist", keywords: ["fist", "power", "strength"] },
  { emoji: "👊", name: "oncoming fist", keywords: ["fist", "punch", "fight"] },
  { emoji: "🤛", name: "left fist", keywords: ["fist", "left", "bump"] },
  { emoji: "🤜", name: "right fist", keywords: ["fist", "right", "bump"] },
  { emoji: "👏", name: "clap", keywords: ["clap", "applause", "bravo"] },
  {
    emoji: "🙌",
    name: "raising hands",
    keywords: ["celebrate", "hooray", "hands"],
  },
  { emoji: "👐", name: "open hands", keywords: ["hug", "open", "jazz"] },
  { emoji: "🤲", name: "palms up", keywords: ["pray", "hands", "offer"] },
  {
    emoji: "🙏",
    name: "folded hands",
    keywords: ["pray", "please", "thank", "namaste"],
  },
  { emoji: "✍️", name: "writing hand", keywords: ["write", "pen", "sign"] },
  {
    emoji: "💅",
    name: "nail polish",
    keywords: ["nails", "polish", "fabulous"],
  },
  // Hearts & Symbols
  { emoji: "❤️", name: "red heart", keywords: ["love", "heart", "red"] },
  { emoji: "🧡", name: "orange heart", keywords: ["love", "heart", "orange"] },
  { emoji: "💛", name: "yellow heart", keywords: ["love", "heart", "yellow"] },
  { emoji: "💚", name: "green heart", keywords: ["love", "heart", "green"] },
  { emoji: "💙", name: "blue heart", keywords: ["love", "heart", "blue"] },
  { emoji: "💜", name: "purple heart", keywords: ["love", "heart", "purple"] },
  { emoji: "🖤", name: "black heart", keywords: ["love", "heart", "black"] },
  { emoji: "🤍", name: "white heart", keywords: ["love", "heart", "white"] },
  { emoji: "🤎", name: "brown heart", keywords: ["love", "heart", "brown"] },
  { emoji: "💔", name: "broken heart", keywords: ["broken", "heart", "sad"] },
  { emoji: "❣️", name: "heart exclamation", keywords: ["heart", "love"] },
  { emoji: "💕", name: "two hearts", keywords: ["love", "hearts", "cute"] },
  {
    emoji: "💞",
    name: "revolving hearts",
    keywords: ["love", "hearts", "spin"],
  },
  { emoji: "💓", name: "beating heart", keywords: ["love", "heart", "beat"] },
  { emoji: "💗", name: "growing heart", keywords: ["love", "heart", "grow"] },
  {
    emoji: "💖",
    name: "sparkling heart",
    keywords: ["love", "heart", "sparkle"],
  },
  { emoji: "💝", name: "heart ribbon", keywords: ["love", "heart", "gift"] },
  { emoji: "💘", name: "heart arrow", keywords: ["love", "heart", "cupid"] },
  { emoji: "💟", name: "heart decoration", keywords: ["love", "heart"] },
  { emoji: "☮️", name: "peace", keywords: ["peace", "symbol"] },
  { emoji: "✝️", name: "cross", keywords: ["cross", "religion"] },
  { emoji: "⭐", name: "star", keywords: ["star", "yellow", "bright"] },
  { emoji: "🌟", name: "glowing star", keywords: ["star", "glow", "shine"] },
  { emoji: "✨", name: "sparkles", keywords: ["sparkle", "shine", "magic"] },
  { emoji: "💫", name: "dizzy star", keywords: ["dizzy", "star", "spin"] },
  { emoji: "🔥", name: "fire", keywords: ["fire", "hot", "flame"] },
  { emoji: "💥", name: "boom", keywords: ["explosion", "crash", "bang"] },
  { emoji: "💦", name: "water drops", keywords: ["water", "sweat", "drops"] },
  { emoji: "💨", name: "wind", keywords: ["wind", "fast", "air"] },
  { emoji: "💬", name: "speech bubble", keywords: ["talk", "chat", "comment"] },
  { emoji: "💭", name: "thought bubble", keywords: ["think", "thought"] },
  { emoji: "💤", name: "zzz", keywords: ["sleep", "zzz", "tired"] },
  // Animals
  { emoji: "🐶", name: "dog", keywords: ["dog", "puppy", "pet"] },
  { emoji: "🐱", name: "cat", keywords: ["cat", "kitten", "pet"] },
  { emoji: "🐭", name: "mouse", keywords: ["mouse", "animal"] },
  { emoji: "🐹", name: "hamster", keywords: ["hamster", "cute", "pet"] },
  { emoji: "🐰", name: "rabbit", keywords: ["rabbit", "bunny", "cute"] },
  { emoji: "🦊", name: "fox", keywords: ["fox", "clever", "animal"] },
  { emoji: "🐻", name: "bear", keywords: ["bear", "animal"] },
  { emoji: "🐼", name: "panda", keywords: ["panda", "bear", "cute"] },
  { emoji: "🐨", name: "koala", keywords: ["koala", "bear", "australia"] },
  { emoji: "🐯", name: "tiger", keywords: ["tiger", "cat", "wild"] },
  { emoji: "🦁", name: "lion", keywords: ["lion", "king", "animal"] },
  { emoji: "🐮", name: "cow", keywords: ["cow", "moo", "farm"] },
  { emoji: "🐷", name: "pig", keywords: ["pig", "oink", "farm"] },
  { emoji: "🐸", name: "frog", keywords: ["frog", "green", "hop"] },
  { emoji: "🐵", name: "monkey", keywords: ["monkey", "ape", "animal"] },
  { emoji: "🐔", name: "chicken", keywords: ["chicken", "hen", "farm"] },
  { emoji: "🐧", name: "penguin", keywords: ["penguin", "bird", "cold"] },
  { emoji: "🐦", name: "bird", keywords: ["bird", "tweet", "fly"] },
  { emoji: "🦆", name: "duck", keywords: ["duck", "quack", "bird"] },
  { emoji: "🦅", name: "eagle", keywords: ["eagle", "bird", "fly"] },
  {
    emoji: "🦋",
    name: "butterfly",
    keywords: ["butterfly", "insect", "pretty"],
  },
  { emoji: "🐛", name: "bug", keywords: ["bug", "caterpillar", "insect"] },
  { emoji: "🐝", name: "bee", keywords: ["bee", "honey", "buzz"] },
  { emoji: "🐢", name: "turtle", keywords: ["turtle", "slow", "shell"] },
  { emoji: "🐍", name: "snake", keywords: ["snake", "reptile", "slither"] },
  { emoji: "🦖", name: "t-rex", keywords: ["dinosaur", "trex", "dino"] },
  { emoji: "🐳", name: "whale", keywords: ["whale", "ocean", "big"] },
  { emoji: "🐬", name: "dolphin", keywords: ["dolphin", "ocean", "smart"] },
  { emoji: "🦈", name: "shark", keywords: ["shark", "ocean", "danger"] },
  { emoji: "🐙", name: "octopus", keywords: ["octopus", "ocean", "tentacle"] },
  // Food
  { emoji: "🍎", name: "apple", keywords: ["apple", "red", "fruit"] },
  { emoji: "🍊", name: "orange", keywords: ["orange", "fruit", "citrus"] },
  { emoji: "🍋", name: "lemon", keywords: ["lemon", "sour", "citrus"] },
  { emoji: "🍇", name: "grapes", keywords: ["grapes", "fruit", "wine"] },
  { emoji: "🍓", name: "strawberry", keywords: ["strawberry", "fruit", "red"] },
  { emoji: "🍕", name: "pizza", keywords: ["pizza", "food", "italian"] },
  { emoji: "🍔", name: "burger", keywords: ["burger", "food", "fast food"] },
  { emoji: "🍟", name: "fries", keywords: ["fries", "fast food", "potato"] },
  { emoji: "🌮", name: "taco", keywords: ["taco", "food", "mexican"] },
  { emoji: "🍜", name: "noodles", keywords: ["noodles", "ramen", "asian"] },
  { emoji: "🍣", name: "sushi", keywords: ["sushi", "japanese", "fish"] },
  {
    emoji: "🍦",
    name: "ice cream",
    keywords: ["ice cream", "sweet", "dessert"],
  },
  { emoji: "🍩", name: "donut", keywords: ["donut", "sweet", "dessert"] },
  {
    emoji: "🎂",
    name: "birthday cake",
    keywords: ["cake", "birthday", "celebrate"],
  },
  { emoji: "☕", name: "coffee", keywords: ["coffee", "hot", "morning"] },
  { emoji: "🍺", name: "beer", keywords: ["beer", "drink", "cheers"] },
  // Objects & Symbols
  { emoji: "💻", name: "laptop", keywords: ["laptop", "computer", "tech"] },
  { emoji: "📱", name: "phone", keywords: ["phone", "mobile", "smartphone"] },
  { emoji: "🖥️", name: "desktop", keywords: ["computer", "desktop", "screen"] },
  { emoji: "⌨️", name: "keyboard", keywords: ["keyboard", "type", "input"] },
  { emoji: "🖨️", name: "printer", keywords: ["printer", "print", "office"] },
  { emoji: "📷", name: "camera", keywords: ["camera", "photo", "picture"] },
  { emoji: "🎵", name: "music note", keywords: ["music", "note", "song"] },
  { emoji: "🎸", name: "guitar", keywords: ["guitar", "music", "rock"] },
  { emoji: "📚", name: "books", keywords: ["books", "read", "study"] },
  { emoji: "📝", name: "memo", keywords: ["note", "write", "memo"] },
  { emoji: "📌", name: "pin", keywords: ["pin", "location", "bookmark"] },
  { emoji: "📎", name: "paperclip", keywords: ["clip", "attach", "paperclip"] },
  { emoji: "🔍", name: "search", keywords: ["search", "find", "magnify"] },
  { emoji: "🔒", name: "locked", keywords: ["lock", "secure", "private"] },
  { emoji: "🔑", name: "key", keywords: ["key", "lock", "access"] },
  { emoji: "🏠", name: "house", keywords: ["house", "home", "building"] },
  { emoji: "🚀", name: "rocket", keywords: ["rocket", "space", "launch"] },
  { emoji: "✈️", name: "airplane", keywords: ["plane", "flight", "travel"] },
  { emoji: "🚗", name: "car", keywords: ["car", "drive", "auto"] },
  { emoji: "🎮", name: "controller", keywords: ["game", "controller", "play"] },
  { emoji: "🏆", name: "trophy", keywords: ["trophy", "win", "award"] },
  { emoji: "🎯", name: "bullseye", keywords: ["target", "goal", "aim"] },
  { emoji: "💡", name: "bulb", keywords: ["idea", "light", "think"] },
  { emoji: "🔔", name: "bell", keywords: ["bell", "alert", "notify"] },
  {
    emoji: "📢",
    name: "megaphone",
    keywords: ["loud", "announce", "megaphone"],
  },
  { emoji: "🚨", name: "alert", keywords: ["alert", "emergency", "warning"] },
  { emoji: "✅", name: "check", keywords: ["check", "done", "correct", "yes"] },
  { emoji: "❌", name: "cross mark", keywords: ["no", "wrong", "error", "x"] },
  { emoji: "⚠️", name: "warning", keywords: ["warning", "caution", "alert"] },
  { emoji: "💯", name: "hundred", keywords: ["100", "perfect", "score"] },
  { emoji: "🆕", name: "new", keywords: ["new", "fresh"] },
  { emoji: "🆘", name: "sos", keywords: ["sos", "help", "emergency"] },
  { emoji: "🌈", name: "rainbow", keywords: ["rainbow", "colorful", "pride"] },
  {
    emoji: "⚡",
    name: "lightning",
    keywords: ["lightning", "bolt", "electric"],
  },
  { emoji: "❄️", name: "snowflake", keywords: ["snow", "cold", "winter"] },
  { emoji: "🌙", name: "moon", keywords: ["moon", "night", "crescent"] },
  { emoji: "☀️", name: "sun", keywords: ["sun", "sunny", "warm"] },
  { emoji: "🌍", name: "earth", keywords: ["earth", "world", "globe"] },
  {
    emoji: "🎉",
    name: "party popper",
    keywords: ["party", "celebrate", "congrats"],
  },
  {
    emoji: "🎊",
    name: "confetti",
    keywords: ["confetti", "party", "celebrate"],
  },
  { emoji: "🎁", name: "gift", keywords: ["gift", "present", "birthday"] },
  { emoji: "🎀", name: "ribbon", keywords: ["ribbon", "bow", "gift"] },
];

const EmojiList = (props: any) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const itemsRef = useRef(props.items);
  const editorRef = useRef(props.editor);
  const rangeRef = useRef(props.range);
  const selectedIndexRef = useRef(selectedIndex);

  itemsRef.current = props.items;
  editorRef.current = props.editor;
  rangeRef.current = props.range;
  selectedIndexRef.current = selectedIndex;

  const selectItem = (index: number) => {
    const item: EmojiItem = itemsRef.current[index];
    if (!item) return;
    editorRef.current
      .chain()
      .focus()
      .deleteRange(rangeRef.current)
      .insertContent({ type: "text", text: item.emoji })
      .run();
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useEffect(() => {
    containerRef.current
      ?.querySelector(`[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useLayoutEffect(() => {
    const handler = ({ event }: { event: KeyboardEvent }) => {
      const len = itemsRef.current.length;
      if (len === 0) return false;
      const cols = EMOJI_GRID_COLUMNS;
      if (event.key === "ArrowRight") {
        setSelectedIndex((prev) => (prev + 1) % len);
        return true;
      }
      if (event.key === "ArrowLeft") {
        setSelectedIndex((prev) => (prev - 1 + len) % len);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev + cols) % len);
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev - cols + len) % len);
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndexRef.current);
        return true;
      }
      return false;
    };
    props.registerKeyDown(handler);
  }, []);

  if (!props.items.length) return null;

  const selectedName = (props.items as EmojiItem[])[selectedIndex]?.name ?? "";

  return (
    <div
      className="flex relative z-50 flex-col rounded-lg border shadow-lg border-border bg-background animate-fade-in-scale"
      style={{ width: `${EMOJI_GRID_COLUMNS * 40 + 8}px` }}
    >
      <div ref={containerRef} className="overflow-y-auto p-1 max-h-56">
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${EMOJI_GRID_COLUMNS}, minmax(0, 1fr))`,
          }}
        >
          {(props.items as EmojiItem[]).map((item, index) => (
            <button
              key={`${item.emoji}-${index}`}
              data-index={index}
              title={item.name}
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(index);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`flex justify-center items-center w-full h-9 rounded text-lg transition-colors ${
                index === selectedIndex
                  ? "bg-primary/10 text-foreground"
                  : "hover:bg-muted/50 text-foreground"
              }`}
            >
              {item.emoji}
            </button>
          ))}
        </div>
      </div>
      <div className="px-2 py-1 text-xs text-center truncate border-t border-border text-foreground/60">
        {selectedName}
      </div>
    </div>
  );
};

const emojiSuggestion = {
  char: ":",
  startOfLine: false,
  items: ({ query }: { query: string }) => {
    try {
      if (!query || !/^[a-zA-Z0-9]/.test(query)) return [];
      const q = query.toLowerCase();
      return EMOJIS.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.toLowerCase().includes(q)),
      );
    } catch {
      return [];
    }
  },
  render: () => {
    let reactRenderer: ReactRenderer | undefined;
    let keyDownHandler: ((props: { event: KeyboardEvent }) => boolean) | null =
      null;
    let currentEditor: any = null;
    let currentRange: any = null;
    let currentItems: any[] = [];
    const registerKeyDown = (
      fn: (props: { event: KeyboardEvent }) => boolean,
    ) => {
      keyDownHandler = fn;
    };
    return {
      onStart: (props: any) => {
        currentEditor = props.editor;
        currentRange = props.range;
        currentItems = props.items ?? [];
        if (!props.clientRect) return;
        reactRenderer = new ReactRenderer(EmojiList, {
          props: { ...props, registerKeyDown },
          editor: props.editor,
        });
        reactRenderer.element.style.position = "absolute";
        reactRenderer.element.style.zIndex = "50";
        document.body.appendChild(reactRenderer.element);
        updatePosition(props.editor, reactRenderer.element);
      },
      onUpdate(props: any) {
        currentEditor = props.editor;
        currentRange = props.range;
        currentItems = props.items ?? [];
        reactRenderer?.updateProps({ ...props, registerKeyDown });
        if (!props.clientRect) return;
        updatePosition(props.editor, reactRenderer!.element);
      },
      onKeyDown(props: { event: KeyboardEvent }) {
        if (props.event.key === "Escape") {
          currentEditor?.chain().focus().deleteRange(currentRange).run();
          reactRenderer?.destroy();
          reactRenderer?.element.remove();
          return true;
        }
        if (props.event.key === "Enter" && currentItems.length === 0) {
          currentEditor?.chain().focus().deleteRange(currentRange).run();
          reactRenderer?.destroy();
          reactRenderer?.element.remove();
          return true;
        }
        return keyDownHandler?.(props) ?? false;
      },
      onExit() {
        keyDownHandler = null;
        reactRenderer?.destroy();
        reactRenderer?.element.remove();
      },
    };
  },
};

export const EmojiPicker = Extension.create({
  name: "emojiPicker",
  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: EmojiSuggestionKey,
        editor: this.editor,
        ...emojiSuggestion,
      }),
    ];
  },
});
