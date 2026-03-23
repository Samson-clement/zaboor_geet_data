const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const videos = JSON.parse(fs.readFileSync(path.join(dataDir, 'videos.json'), 'utf8'));
const songs = JSON.parse(fs.readFileSync(path.join(dataDir, 'songs.json'), 'utf8'));

// Clear all existing videos arrays
songs.forEach(s => { s.videos = []; });

// Build lookup maps
const songById = {};
const songsByTypeAndNumber = {}; // e.g. "psalm-23" => [ps-023, ps-023a, ...]
songs.forEach(s => {
  songById[s.id] = s;
  const typeKey = `${s.type}-${s.number}`;
  if (!songsByTypeAndNumber[typeKey]) songsByTypeAndNumber[typeKey] = [];
  songsByTypeAndNumber[typeKey].push(s);
});

// Specific title-based mappings (case-insensitive matching on video title_en)
const titleMappings = [
  { pattern: /Rab Ayali/i, songId: 'ps-023' },
  { pattern: /Khudawand Mera Chopan/i, songId: 'ps-023' },
  { pattern: /Tu Aakh Aye Meri Jaan/i, songId: 'ps-103a' },
  { pattern: /Tu Aakh Aye Mere Jaan/i, songId: 'ps-103a' },
  { pattern: /Rehmat Na*al/i, songId: 'ps-103b' },
  { pattern: /Ya Rab Tu Mer[ei] Panah/i, songId: 'ps-091b' },
  { pattern: /Khuda De Par De/i, songId: 'ps-091a' },
  { pattern: /Sikhawan Ga Tenu/i, songId: 'ps-032b' },
  { pattern: /Oh Dhan Jis De/i, songId: 'ps-032a' },
  { pattern: /Teriyaan Siftaan/i, songId: 'ps-092a' },
  { pattern: /Tere Siftan/i, songId: 'ps-092a' },
  { pattern: /Aye Mere Shah/i, songId: 'ps-145a' },
  { pattern: /Nihayat/i, songId: 'ps-145b' },
  { pattern: /Meharban/i, songId: 'ps-145b' },
  { pattern: /Jawan Bhala/i, songId: 'ps-119a' },
  { pattern: /Teri Najat/i, songId: 'ps-119b' },
  { pattern: /Najaat/i, songId: 'ps-119b' },
  { pattern: /Hun Te Main Yahowa/i, songId: 'ps-055' },
  { pattern: /Rab Sachmuch/i, songId: 'ps-069e' },
  { pattern: /Rab Sach Much/i, songId: 'ps-069e' },
  { pattern: /Sun Aye Beti/i, songId: 'ps-045b' },
  { pattern: /Mere Dil Wich Shah/i, songId: 'ps-045a' },
  { pattern: /Sub Logo Mahangay/i, songId: 'ps-047b' },
  { pattern: /Sab Loko/i, songId: 'ps-047b' },
  { pattern: /Karo Rabb Dee/i, songId: 'ps-148' },
  { pattern: /Karo Rab/i, songId: 'ps-148' },
];

let matched = 0;
let unmatched = 0;
const unmatchedVideos = [];

for (const video of videos) {
  const title = video.title_en;
  const videoEntry = { video_id: video.video_id, title: title };

  // Determine the song type based on video category
  let songType = null;
  if (video.category === 'psalms') songType = 'psalm';
  else if (video.category === 'hymns') songType = 'hymn';
  else if (video.category === 'worship') songType = 'hymn'; // try matching worship to hymns

  // Extract number from title
  const zaboorMatch = title.match(/Zaboor\s+(\d+)/i);
  const geetMatch = title.match(/Geet\s+(\d+)/i);
  const hymnMatch = title.match(/Hymn\s+(\d+)/i);

  let number = null;
  if (zaboorMatch) number = parseInt(zaboorMatch[1]);
  else if (geetMatch) number = parseInt(geetMatch[1]);
  else if (hymnMatch) number = parseInt(hymnMatch[1]);

  // Try specific title matching first
  let specificMatch = null;
  for (const mapping of titleMappings) {
    if (mapping.pattern.test(title)) {
      specificMatch = mapping.songId;
      break;
    }
  }

  if (specificMatch && songById[specificMatch]) {
    songById[specificMatch].videos.push(videoEntry);
    matched++;
    continue;
  }

  // For psalms/hymns with a number, find matching songs
  if (number !== null && songType) {
    const key = `${songType}-${number}`;
    const matchingSongs = songsByTypeAndNumber[key];
    if (matchingSongs && matchingSongs.length > 0) {
      // Add to all parts of this number
      matchingSongs.forEach(s => s.videos.push(videoEntry));
      matched++;
      continue;
    }
  }

  // For hymns without a number, try matching by title keywords to hymn songs
  if (video.category === 'hymns' || video.category === 'worship') {
    // Try to find a hymn song whose title_en appears in the video title or vice versa
    const titleWords = title.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    let bestMatch = null;
    let bestScore = 0;
    for (const song of songs) {
      if (song.type !== 'hymn') continue;
      const songTitle = song.title_en.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3);
      const overlap = titleWords.filter(w => songTitle.includes(w)).length;
      if (overlap > bestScore && overlap >= 2) {
        bestScore = overlap;
        bestMatch = song;
      }
    }
    if (bestMatch) {
      bestMatch.videos.push(videoEntry);
      matched++;
      continue;
    }
  }

  unmatched++;
  unmatchedVideos.push(`  [${video.id}] ${title} (${video.category})`);
}

// Write updated songs.json
fs.writeFileSync(path.join(dataDir, 'songs.json'), JSON.stringify(songs, null, 2) + '\n', 'utf8');

// Summary
console.log('=== Video Matching Summary ===');
console.log(`Total videos: ${videos.length}`);
console.log(`Matched: ${matched}`);
console.log(`Unmatched: ${unmatched}`);

// Count songs with videos
const songsWithVideos = songs.filter(s => s.videos.length > 0).length;
console.log(`Songs with at least one video: ${songsWithVideos}`);
console.log(`Total songs: ${songs.length}`);

if (unmatchedVideos.length > 0) {
  console.log(`\nUnmatched videos:`);
  unmatchedVideos.forEach(v => console.log(v));
}

// Show top songs by video count
console.log('\nTop 15 songs by video count:');
songs.filter(s => s.videos.length > 0)
  .sort((a, b) => b.videos.length - a.videos.length)
  .slice(0, 15)
  .forEach(s => console.log(`  ${s.id} (${s.title_en}): ${s.videos.length} videos`));
