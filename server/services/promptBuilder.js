/**
 * promptBuilder.js
 *
 * Single source of truth for:
 * 1. Available SFX assets
 * 2. Available BGM tracks
 * 3. System prompt
 * 4. User prompt builder
 *
 * To add new SFX: drop file in assets/sfx/ and add entry to AVAILABLE_SFX.
 * To add new BGM: drop file in assets/music/ and add entry to AVAILABLE_BGM.
 * No other file needs to change.
 */

// ─── SFX Inventory ────────────────────────────────────────────────────────────
const AVAILABLE_SFX = [
  {
    id: "impact_soft",
    file: "impact_soft.wav",
    label: "Soft Impact",
    color: "#34d399",
    description: "A gentle but definite thud. Adds weight to a statement without being aggressive.",
    goodFor: ["key facts", "strong statements", "punchlines", "reveals", "data points", "conclusions"],
    avoid: ["casual filler sentences", "transitions", "questions"],
    energy: "medium",
  },
  {
    id: "pause_click",
    file: "pause_click.wav",
    label: "Pause Click",
    color: "#fb7185",
    description: "A subtle dry tick. Marks a beat where the speaker lets something land.",
    goodFor: ["dramatic pauses", "after a punchline", "before a reveal", "beat moments"],
    avoid: ["fast-paced sections", "lists", "transitions"],
    energy: "low",
  },
  {
    id: "question_ping",
    file: "question_ping.wav",
    label: "Question Ping",
    color: "#60a5fa",
    description: "A light rising tone. Signals curiosity, a question, or an open loop.",
    goodFor: ["rhetorical questions", "direct questions to audience", "raising curiosity", "challenging assumptions"],
    avoid: ["statements", "conclusions", "emotional moments"],
    energy: "low",
  },
  {
    id: "tension_rise",
    file: "tension_rise.wav",
    label: "Tension Rise",
    color: "#f97316",
    description: "A slow ambient swell. Builds emotional stakes. Use sparingly.",
    goodFor: ["conflict", "problems being introduced", "before a big reveal", "suspenseful moments", "vulnerability"],
    avoid: ["happy moments", "conclusions", "tips and takeaways"],
    energy: "high",
  },
  {
    id: "transition_whoosh",
    file: "transition_whoosh.wav",
    label: "Transition Whoosh",
    color: "#a78bfa",
    description: "A smooth swoosh. Signals a clear shift in topic, scene, or time.",
    goodFor: ["topic changes", "section transitions", "time jumps", "moving to next point"],
    avoid: ["mid-sentence", "emotional peaks", "conclusions"],
    energy: "medium",
  },
  {
    id: "clock_tick",
    file: "freesound_community-clock-ticking-83775.mp3",
    label: "Clock Tick",
    color: "#fbbf24",
    description: "A ticking clock. Creates urgency and marks time-sensitive moments.",
    goodFor: ["deadlines", "urgency", "time references", "countdowns", "before it's too late"],
    avoid: ["relaxed reflective moments", "emotional stories", "conclusions"],
    energy: "medium",
  },
  {
    id: "breath_exhale",
    file: "freesound_community-deep-sigh-and-exhale-102832.mp3",
    label: "Breath Exhale",
    color: "#94a3b8",
    description: "A deep sigh or exhale. Signals relief, resignation, or stepping back.",
    goodFor: ["relief after tension", "honest admissions", "vulnerability", "exhaustion moments"],
    avoid: ["upbeat sections", "tips", "facts and data"],
    energy: "low",
  },
  {
    id: "paper_slide",
    file: "freesound_community-paper-slide-89980.mp3",
    label: "Paper Slide",
    color: "#cbd5e1",
    description: "A crisp paper slide. Clean and professional for educational transitions.",
    goodFor: ["introducing a new concept", "step-by-step transitions", "educational section breaks"],
    avoid: ["emotional peaks", "storytelling climax", "comedy moments"],
    energy: "low",
  },
  {
    id: "success_chime",
    file: "freesound_crunchpixstudio-great-success-384935.mp3",
    label: "Success Chime",
    color: "#4ade80",
    description: "A bright celebratory chime. Clear signal of a win or positive outcome.",
    goodFor: ["big wins", "achievements", "positive results", "success stories", "good news reveals"],
    avoid: ["problems", "challenges", "neutral statements", "questions"],
    energy: "high",
  },
  {
    id: "success_warm",
    file: "meldix-success-340660.mp3",
    label: "Warm Success",
    color: "#86efac",
    description: "A softer warmer success sound. More personal and understated.",
    goodFor: ["personal achievements", "quiet wins", "relief", "things finally working out"],
    avoid: ["big dramatic wins", "data reveals", "fast-paced sections"],
    energy: "low",
  },
  {
    id: "subtle_pop",
    file: "soundreality-pop-423717.mp3",
    label: "Subtle Pop",
    color: "#e879f9",
    description: "A light satisfying pop. Adds texture to bullet points or quick emphasis.",
    goodFor: ["bullet points", "quick tips", "list items", "light emphasis", "short punchy statements"],
    avoid: ["emotional moments", "long complex sentences", "tension"],
    energy: "low",
  },
  {
    id: "warm_chord",
    file: "sound_garage-em-guitar-chord-strum-4-309537.mp3",
    label: "Warm Guitar Chord",
    color: "#f59e0b",
    description: "A single warm guitar strum. Humanizes emotional or reflective moments.",
    goodFor: ["personal stories", "vulnerability", "emotional peaks", "reflective moments", "storytelling climax"],
    avoid: ["data heavy sections", "fast transitions", "comedy"],
    energy: "low",
  },
  {
    id: "notification_ding",
    file: "universfield-new-notification-040-493469.mp3",
    label: "Notification Ding",
    color: "#38bdf8",
    description: "A clean notification sound. Flags something the viewer should remember.",
    goodFor: ["key takeaways", "tips", "important reminders", "call to action", "pro tips"],
    avoid: ["emotional moments", "storytelling", "transitions"],
    energy: "low",
  },
  {
    id: "soft_error",
    file: "u_31vnwfmzt6-error-126627.mp3",
    label: "Soft Error",
    color: "#f87171",
    description: "A gentle error sound. Flags mistakes, misconceptions, or what NOT to do.",
    goodFor: ["common mistakes", "misconceptions", "wrong approaches", "what not to do", "things that failed"],
    avoid: ["positive moments", "neutral statements", "conclusions"],
    energy: "medium",
  },
  {
    id: "cha_ching",
    file: "freesound_community-cha-ching-7053.mp3",
    label: "Cha-Ching",
    color: "#fde68a",
    description: "A cash register sound. Perfect for money, results, ROI, or business wins.",
    goodFor: ["money references", "results", "ROI", "revenue", "business wins", "financial outcomes"],
    avoid: ["emotional stories", "problems", "educational dry content"],
    energy: "medium",
  },
  {
    id: "idea_ding",
    file: "freesound_community-ding-idea-40142.mp3",
    label: "Idea Ding",
    color: "#fcd34d",
    description: "A lightbulb moment sound. Marks realizations, insights, and aha moments.",
    goodFor: ["realizations", "aha moments", "insights", "solutions being revealed", "things clicking"],
    avoid: ["problems", "emotional low points", "transitions"],
    energy: "low",
  },
  {
    id: "record_scratch",
    file: "freesound_community-dj-scratch-87179.mp3",
    label: "Record Scratch",
    color: "#c084fc",
    description: "A DJ scratch. Hard pattern interrupt — stops the viewer in their tracks.",
    goodFor: ["unexpected turns", "plot twists", "contradictions", "wait-what moments", "subverting expectations"],
    avoid: ["serious emotional content", "smooth storytelling", "professional LinkedIn tone"],
    energy: "high",
  },
  {
    id: "keyboard_typing",
    file: "dragon-studio-keyboard-typing-effect-free-393912.mp3",
    label: "Keyboard Typing",
    color: "#67e8f9",
    description: "Keyboard typing sounds. Signals action, productivity, or step-by-step guidance.",
    goodFor: ["action steps", "how-to moments", "productivity tips", "things to implement", "tactical advice"],
    avoid: ["emotional stories", "reflective moments", "big reveals"],
    energy: "medium",
  },
  {
    id: "dream_sequence",
    file: "fronbondi_skegs-sfx-dream-sequence-sound-effect-438112.mp3",
    label: "Dream Sequence",
    color: "#818cf8",
    description: "An ethereal dreamy sound. Marks imagination, vision, or possibility thinking.",
    goodFor: ["picture this moments", "imagination", "future vision", "what if scenarios", "mindset shifts"],
    avoid: ["practical how-to", "data points", "mistakes or problems"],
    energy: "low",
  },
  {
    id: "crowd_applause",
    file: "pwlpl-applause-sound-effect-521104.mp3",
    label: "Crowd Applause",
    color: "#6ee7b7",
    description: "Short crowd applause. Validates impressive stats or major achievements.",
    goodFor: ["impressive statistics", "major achievements", "social proof", "big claims", "record-breaking moments"],
    avoid: ["personal quiet stories", "educational dry content", "overuse — once per video max"],
    energy: "high",
  },
  {
    id: "heartbeat",
    file: "shidenbeatsmusic-heartbeat-sound-effect-111218.mp3",
    label: "Heartbeat",
    color: "#fca5a5",
    description: "A thumping heartbeat. Builds anticipation, nervousness, or high stakes.",
    goodFor: ["high stakes moments", "anticipation", "nervousness", "before a big decision", "tension before reveal"],
    avoid: ["calm reflective moments", "tips", "positive conclusions"],
    energy: "high",
  },
  {
    id: "finger_snap",
    file: "soundreality-finger-snap-reverb-423222.mp3",
    label: "Finger Snap",
    color: "#f0abfc",
    description: "A reverby finger snap. Signals simplicity, quickness, or an easy solution.",
    goodFor: ["quick solutions", "just like that moments", "simple tips", "efficiency", "fast results"],
    avoid: ["complex explanations", "emotional vulnerability", "problem-heavy sections"],
    energy: "low",
  },
  {
    id: "glitch",
    file: "soundreality-glitch-effect-3-530928.mp3",
    label: "Glitch Effect",
    color: "#a3e635",
    description: "A digital glitch. Disrupts flow intentionally — for pattern breaks or tech references.",
    goodFor: ["plot twists", "system failures", "tech problems", "disruption moments", "before a reframe"],
    avoid: ["emotional stories", "warm personal content", "professional LinkedIn tone"],
    energy: "high",
  },
  {
    id: "level_up",
    file: "universfield-level-up-05-326133.mp3",
    label: "Level Up",
    color: "#34d399",
    description: "A game-style level up sound. Marks growth, progress, or unlocking something.",
    goodFor: ["growth moments", "leveling up metaphors", "progress", "skill unlocks", "transformation points"],
    avoid: ["problems", "conflict", "neutral transitions"],
    energy: "high",
  },
  {
    id: "wind_chimes",
    file: "derrickmckinnon-wind-chimes-478275.mp3",
    label: "Wind Chimes",
    color: "#bae6fd",
    description: "Soft wind chimes. Creates a peaceful calming moment or gentle transition.",
    goodFor: ["peaceful transitions", "calm reflection", "mindfulness moments", "before a soft conclusion"],
    avoid: ["high energy sections", "urgent moments", "conflict or tension"],
    energy: "low",
  },
];

// ─── BGM Inventory ────────────────────────────────────────────────────────────
const AVAILABLE_BGM = [
  {
    id: "corporate_upbeat",
    file: "joyinsound-corporate-upbeat-motivational-music-royalty-free-496474.mp3",
    label: "Corporate Upbeat",
    color: "#60a5fa",
    mood: "positive, professional, motivational",
    energy: "medium-high",
    bestFor: ["educational content", "tips and how-to", "LinkedIn", "professional announcements"],
    avoid: ["emotional personal stories", "dark conflict sections", "comedy"],
    baseVolume: 0.18,
  },
  {
    id: "jazzy_hiphop",
    file: "soulfuljamtracks-jazzy-hip-hop-beat-479850.mp3",
    label: "Jazzy Hip-Hop",
    color: "#a78bfa",
    mood: "chill, cool, modern, confident",
    energy: "medium",
    bestFor: ["casual vlogs", "storytelling", "personal branding", "YouTube long-form"],
    avoid: ["very formal LinkedIn content", "serious emotional moments"],
    baseVolume: 0.15,
  },
  {
    id: "cinematic_ambient",
    file: "openmindaudio-cinematic-ambient-glass-rain-over-silent-streets-short-preview-492663.mp3",
    label: "Cinematic Ambient",
    color: "#94a3b8",
    mood: "dark, atmospheric, cinematic, reflective",
    energy: "low",
    bestFor: ["problem setup", "emotional storytelling", "conflict sections", "vulnerability"],
    avoid: ["upbeat tips content", "comedy", "quick wins"],
    baseVolume: 0.14,
  },
  {
    id: "warm_feeling",
    file: "kaazoom-that-warm-feeling-30-sec-edit-532442.mp3",
    label: "Warm Feeling",
    color: "#fbbf24",
    mood: "warm, intimate, soft, heartfelt",
    energy: "low",
    bestFor: ["personal stories", "vulnerability", "emotional peaks", "storytelling conclusions"],
    avoid: ["fast-paced content", "data-driven explainers", "comedy"],
    baseVolume: 0.16,
  },
  {
    id: "ukulele_wave",
    file: "freesound_community-ukewave-74471.mp3",
    label: "Ukulele Wave",
    color: "#86efac",
    mood: "light, fun, approachable, cheerful",
    energy: "medium",
    bestFor: ["comedy moments", "quick wins", "relatable content", "Instagram Reels", "YouTube Shorts"],
    avoid: ["serious professional tone", "dark conflict", "emotional vulnerability"],
    baseVolume: 0.17,
  },
  {
    id: "ambient_game",
    file: "freesound_community-ambient-game-67014.mp3",
    label: "Ambient Game",
    color: "#67e8f9",
    mood: "minimal, electronic, focused, neutral",
    energy: "low",
    bestFor: ["tech content", "data-driven explainers", "tutorials", "screen recordings"],
    avoid: ["emotional stories", "high energy motivational content"],
    baseVolume: 0.14,
  },
  {
    id: "groovy_confident",
    file: "zec53-groovy-funky-confident-whistle-30-sec-480277.mp3",
    label: "Groovy Confident",
    color: "#f59e0b",
    mood: "funky, energetic, bold, confident",
    energy: "high",
    bestFor: ["bold statements", "personal branding", "confident takes", "Instagram Reels"],
    avoid: ["emotional vulnerability", "formal LinkedIn content", "educational dry content"],
    baseVolume: 0.16,
  },
  {
    id: "quirky_positive",
    file: "zec53-quirky-funny-positive-whistle-30-sec-481085.mp3",
    label: "Quirky Positive",
    color: "#e879f9",
    mood: "playful, funny, lighthearted",
    energy: "medium",
    bestFor: ["comedy content", "relatable fails", "fun educational content", "YouTube Shorts"],
    avoid: ["serious professional tone", "emotional stories", "conflict"],
    baseVolume: 0.15,
  },
  {
    id: "epic_reveal",
    file: "breakzstudios-epic-cinematic-reveal-logo-201065.mp3",
    label: "Epic Reveal",
    color: "#f97316",
    mood: "grand, cinematic, powerful, building",
    energy: "high",
    bestFor: ["big reveals", "conclusions", "calls to action", "transformation moments", "climax of story"],
    avoid: ["casual conversational content", "intros", "educational dry sections"],
    baseVolume: 0.2,
  },
  {
    id: "clean_intro",
    file: "aklcreation-akl-intro-02-410983.mp3",
    label: "Clean Intro",
    color: "#38bdf8",
    mood: "clean, modern, sharp, professional",
    energy: "medium",
    bestFor: ["video intros", "hooks", "opening statements", "brand moments"],
    avoid: ["emotional peaks", "conclusions", "mid-video use"],
    baseVolume: 0.18,
  },
  {
    id: "corporate_logo",
    file: "tunetank-corporate-logo-483718.mp3",
    label: "Corporate Logo",
    color: "#cbd5e1",
    mood: "professional, clean, trustworthy, minimal",
    energy: "low",
    bestFor: ["LinkedIn content", "business explainers", "professional announcements", "B2B content"],
    avoid: ["comedy", "emotional personal stories", "high energy Reels"],
    baseVolume: 0.15,
  },
];

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert video editor and sound designer specializing in short-form and long-form content for Instagram Reels, YouTube Shorts, LinkedIn, and YouTube.

Your job is to analyze a video transcript and make two types of decisions:
1. WHERE to place sound effects (SFX) for emotional impact
2. WHICH background music (BGM) track to use, at what volume, and whether to duck it at key moments

The videos you work with are: talking head, vlog, educational, or storytelling style. Medium conversational energy. Professional or semi-professional audience.

You think like a seasoned editor. You understand:
- The overall PURPOSE of the video
- The EMOTIONAL ARC (where energy rises and falls)
- KEY MOMENTS (punchlines, reveals, admissions, lessons)
- PACING and BREATHING ROOM
- PLATFORM CONTEXT (LinkedIn needs restraint, Reels can be punchier)

SFX GOLDEN RULES:
1. Less is more. 5–9 perfectly placed SFX beats 20 random ones every time.
2. SFX should feel INVISIBLE — they enhance emotion, not distract.
3. Never place two SFX within 3 seconds of each other.
4. Respect emotional tone — a vulnerable story does NOT get a whoosh or pop.
5. Place SFX 0.1–0.3 seconds BEFORE the key word, not after.
6. Only use SFX IDs from the provided list — never invent new ones.

BGM GOLDEN RULES:
1. Pick ONE track that fits the overall tone of the video.
2. BGM should sit UNDER the voice, never compete with it. Keep volume low (0.10–0.22).
3. Duck BGM volume further (to 0.05–0.08) under emotionally intense SFX moments.
4. Fade BGM in gently at the start (first 2 seconds) and out at the end (last 3 seconds).
5. If a moment is deeply emotional or needs silence to land — mute BGM entirely for that section.

You must respond ONLY with a valid JSON object. No explanation, no markdown, no preamble. Raw JSON only.`;

// ─── Prompt Builder ───────────────────────────────────────────────────────────
function buildPrompt(transcript) {
  const { words, clip_end, video_id } = transcript;

  // Timestamped transcript grouped into lines of 12 words
  const lines = [];
  let line = [];
  words.forEach((w, i) => {
    line.push(`[${w.start.toFixed(2)}s]${w.word}`);
    if (line.length >= 12 || i === words.length - 1) {
      lines.push(line.join(" "));
      line = [];
    }
  });
  const timestampedTranscript = lines.join("\n");
  const plainText = words.map((w) => w.word).join(" ");

  // SFX menu
  const sfxMenu = AVAILABLE_SFX.map((s) =>
    `- "${s.id}" [${s.energy} energy]: ${s.description}\n  ✓ Good for: ${s.goodFor.join(", ")}\n  ✗ Avoid: ${s.avoid.join(", ")}`
  ).join("\n\n");

  // BGM menu
  const bgmMenu = AVAILABLE_BGM.map((b) =>
    `- "${b.id}" [${b.energy} energy]: ${b.mood}\n  ✓ Best for: ${b.bestFor.join(", ")}\n  ✗ Avoid: ${b.avoid.join(", ")}\n  Suggested base volume: ${b.baseVolume}`
  ).join("\n\n");

  return `Analyze this video transcript and make SFX and BGM decisions.

VIDEO DURATION: ${clip_end.toFixed(1)} seconds
VIDEO ID: ${video_id}

PLAIN TRANSCRIPT (read this first — understand tone, purpose, and emotion):
"${plainText}"

TIMESTAMPED TRANSCRIPT (use exact timestamps for placement):
${timestampedTranscript}

AVAILABLE SOUND EFFECTS (SFX):
${sfxMenu}

AVAILABLE BACKGROUND MUSIC (BGM):
${bgmMenu}

YOUR TASK:
1. Read the full plain transcript. Understand what this video is about and what emotion it's creating.
2. Identify the tone, arc, and best platform for this video.
3. Pick ONE BGM track that fits the overall tone. Decide its base volume and any duck points.
4. Find 5–9 moments where SFX would genuinely enhance the viewer's experience.
5. For SFX: pick the most emotionally appropriate sound, place it at the right timestamp.
6. For BGM ducking: identify moments where BGM should drop lower because a SFX or emotional moment needs space.

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "video_analysis": {
    "tone": "one of: educational | motivational | emotional | humorous | storytelling | conversational | rant | exciting | reflective",
    "purpose": "one sentence — what is this video trying to communicate?",
    "emotional_arc": "one sentence — how does energy or emotion move through the video?",
    "platform_recommendation": "best platform for this video and why, in one sentence",
    "posting_tip": "one specific actionable tip for posting this video to maximize engagement"
  },
  "bgm": {
    "track_id": "exact id from BGM list",
    "base_volume": 0.15,
    "fade_in_duration": 2.0,
    "fade_out_duration": 3.0,
    "reasoning": "one sentence why this track fits this video",
    "duck_points": [
      {
        "timestamp": 0.00,
        "duration": 2.0,
        "duck_volume": 0.06,
        "reason": "why duck here"
      }
    ]
  },
  "events": [
    {
      "id": "sfx_1",
      "sfx_type": "exact id from SFX list",
      "timestamp": 0.00,
      "volume": 0.65,
      "reasoning": "one sentence — why this SFX at this moment",
      "confidence": 0.85,
      "emotional_tag": "one word describing the emotion here"
    }
  ]
}

RULES:
- All timestamps are numbers in seconds
- SFX volume: 0.4–0.85
- BGM base_volume: 0.10–0.22
- BGM duck_volume: 0.04–0.10
- SFX confidence: 0.5–1.0
- Minimum 3 seconds between any two SFX events
- sfx_type must exactly match an id from the SFX list
- track_id must exactly match an id from the BGM list
- duck_points can be empty array if no ducking needed
- Raw JSON only — no markdown, no explanation`;
}

module.exports = { buildPrompt, AVAILABLE_SFX, AVAILABLE_BGM, SYSTEM_PROMPT };