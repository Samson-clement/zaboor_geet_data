const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data', 'songs.json');
const songs = JSON.parse(fs.readFileSync(filePath, 'utf8'));

for (const song of songs) {
  if (Array.isArray(song.videos)) {
    song.videos = song.videos.map(v => (typeof v === 'object' && v.video_id) ? v.video_id : v);
  }
}

fs.writeFileSync(filePath, JSON.stringify(songs, null, 2) + '\n', 'utf8');
console.log(`Converted videos in ${songs.length} songs.`);
