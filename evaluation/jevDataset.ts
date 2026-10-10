import type { IntentProfile } from '../utils/intentStore';
import type { VideoLabel, VideoMeta } from '../utils/classifier/types';

export interface EvaluationCase {
  id: string;
  intentName: 'music' | 'technology' | 'education';
  intent: IntentProfile;
  videoMeta: VideoMeta;
  expectedLabel: VideoLabel;
}

const musicIntent: IntentProfile = {
  niches: ['Music & Audio'],
  customNiche: 'Full songs, official music videos, and instrument lessons. Exclude movie scenes.',
};
const technologyIntent: IntentProfile = {
  niches: ['Technology & Gadgets'],
  customNiche: 'Product reviews, practical tutorials, and technology explainers.',
};
const educationIntent: IntentProfile = {
  niches: ['Education & Study'],
  customNiche: 'Lessons and study guides that teach a subject.',
};

// Provisional labels for smoke evaluation. Review these examples before using
// the reported accuracy as a résumé or product-quality claim.
export const jevEvaluationDataset: EvaluationCase[] = [
  { id: 'music-01', intentName: 'music', intent: musicIntent, videoMeta: { title: 'Kesariya (Official Music Video)', channel: 'Sony Music India' }, expectedLabel: 'relevant' },
  { id: 'music-02', intentName: 'music', intent: musicIntent, videoMeta: { title: 'Tum Hi Ho - Full Song', channel: 'T-Series' }, expectedLabel: 'relevant' },
  { id: 'music-03', intentName: 'music', intent: musicIntent, videoMeta: { title: 'Lo-fi Study Beats - 1 Hour Mix', channel: 'Chillhop Music' }, expectedLabel: 'relevant' },
  { id: 'music-04', intentName: 'music', intent: musicIntent, videoMeta: { title: 'How to Play the F Major Chord on Guitar', channel: 'JustinGuitar' }, expectedLabel: 'relevant' },
  { id: 'music-05', intentName: 'music', intent: musicIntent, videoMeta: { title: 'Live at Wembley: Complete Concert', channel: 'Coldplay' }, expectedLabel: 'relevant' },
  { id: 'music-06', intentName: 'music', intent: musicIntent, videoMeta: { title: 'Beginner Piano Lesson: Read Sheet Music', channel: 'PianoVideoLessons' }, expectedLabel: 'relevant' },
  { id: 'music-07', intentName: 'music', intent: musicIntent, videoMeta: { title: 'Official Audio - Midnight Drive', channel: 'The Midnight' }, expectedLabel: 'relevant' },
  { id: 'music-08', intentName: 'music', intent: musicIntent, videoMeta: { title: 'How to Mix Vocals in GarageBand', channel: 'MusicTechHelpGuy' }, expectedLabel: 'relevant' },
  { id: 'music-09', intentName: 'music', intent: musicIntent, videoMeta: { title: 'Classical Music for Focus: Bach', channel: 'HALIDONMUSIC' }, expectedLabel: 'relevant' },
  { id: 'music-10', intentName: 'music', intent: musicIntent, videoMeta: { title: 'The Story Behind This Guitar Solo', channel: 'Rick Beato' }, expectedLabel: 'relevant' },
  { id: 'music-11', intentName: 'music', intent: musicIntent, videoMeta: { title: 'Arijit Singh Live Performance - Full Set', channel: 'Live Nation' }, expectedLabel: 'relevant' },
  { id: 'music-12', intentName: 'music', intent: musicIntent, videoMeta: { title: 'Learn the Major Scale on Piano', channel: 'Pianote' }, expectedLabel: 'relevant' },
  { id: 'music-13', intentName: 'music', intent: musicIntent, videoMeta: { title: 'Best Headphones for Mixing Music', channel: 'Produce Like A Pro' }, expectedLabel: 'relevant' },
  { id: 'music-14', intentName: 'music', intent: musicIntent, videoMeta: { title: 'Movie Climax Scene HD - Hero Saves the City', channel: 'Movie Scenes HD' }, expectedLabel: 'distraction' },
  { id: 'music-15', intentName: 'music', intent: musicIntent, videoMeta: { title: 'The Final Battle Scene from Action Movie', channel: 'Cinema Clips' }, expectedLabel: 'distraction' },
  { id: 'music-16', intentName: 'music', intent: musicIntent, videoMeta: { title: 'Movie Trailer - Songs from the Soundtrack', channel: 'Film Studio' }, expectedLabel: 'distraction' },
  { id: 'music-17', intentName: 'music', intent: musicIntent, videoMeta: { title: 'Cricket Match Highlights: India vs Australia', channel: 'Sports Central' }, expectedLabel: 'distraction' },

  { id: 'technology-01', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'iPhone 17 Review: Two Weeks Later', channel: 'Marques Brownlee' }, expectedLabel: 'relevant' },
  { id: 'technology-02', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'Best Budget Laptops for Students', channel: 'Dave2D' }, expectedLabel: 'relevant' },
  { id: 'technology-03', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'How to Build a Gaming PC in 2026', channel: 'Linus Tech Tips' }, expectedLabel: 'relevant' },
  { id: 'technology-04', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'What Is a Neural Network? Explained Simply', channel: 'Computerphile' }, expectedLabel: 'relevant' },
  { id: 'technology-05', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'Android 17: Every New Feature', channel: 'The Verge' }, expectedLabel: 'relevant' },
  { id: 'technology-06', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'Raspberry Pi Home Server Tutorial', channel: 'Jeff Geerling' }, expectedLabel: 'relevant' },
  { id: 'technology-07', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'OLED vs Mini LED: Which TV Should You Buy?', channel: 'RTINGS.com' }, expectedLabel: 'relevant' },
  { id: 'technology-08', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'Inside the Newest Data Center', channel: 'Tech Vision' }, expectedLabel: 'relevant' },
  { id: 'technology-09', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'How Does GPS Work?', channel: 'Practical Engineering' }, expectedLabel: 'relevant' },
  { id: 'technology-10', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'Smartwatch Battery Test: 10 Models Compared', channel: 'Mrwhosetheboss' }, expectedLabel: 'relevant' },
  { id: 'technology-11', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'Wi-Fi 7 Router Setup and Speed Test', channel: 'Dong Knows Tech' }, expectedLabel: 'relevant' },
  { id: 'technology-12', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'How to Replace a Laptop SSD', channel: 'Crucial' }, expectedLabel: 'relevant' },
  { id: 'technology-13', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'Why Your Phone Camera Looks Different', channel: 'Gerald Undone' }, expectedLabel: 'relevant' },
  { id: 'technology-14', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'Office Prank: Fake Tech Support Call', channel: 'Jubilee' }, expectedLabel: 'distraction' },
  { id: 'technology-15', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'Funny Robot Dance Challenge', channel: 'Viral Shorts' }, expectedLabel: 'distraction' },
  { id: 'technology-16', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'Movie Scene: Hacker Breaks Into the Mainframe', channel: 'Film Clips' }, expectedLabel: 'distraction' },
  { id: 'technology-17', intentName: 'technology', intent: technologyIntent, videoMeta: { title: 'Top 10 Celebrity Red Carpet Moments', channel: 'Entertainment Tonight' }, expectedLabel: 'distraction' },

  { id: 'education-01', intentName: 'education', intent: educationIntent, videoMeta: { title: 'Algebra Basics: Solving Linear Equations', channel: 'Khan Academy' }, expectedLabel: 'relevant' },
  { id: 'education-02', intentName: 'education', intent: educationIntent, videoMeta: { title: 'Photosynthesis Explained for Beginners', channel: 'Amoeba Sisters' }, expectedLabel: 'relevant' },
  { id: 'education-03', intentName: 'education', intent: educationIntent, videoMeta: { title: 'How to Take Better Notes in Class', channel: 'Ali Abdaal' }, expectedLabel: 'relevant' },
  { id: 'education-04', intentName: 'education', intent: educationIntent, videoMeta: { title: 'World War II: Causes and Timeline', channel: 'CrashCourse' }, expectedLabel: 'relevant' },
  { id: 'education-05', intentName: 'education', intent: educationIntent, videoMeta: { title: 'Learn English: 25 Common Phrasal Verbs', channel: 'BBC Learning English' }, expectedLabel: 'relevant' },
  { id: 'education-06', intentName: 'education', intent: educationIntent, videoMeta: { title: 'Introduction to Organic Chemistry', channel: 'Professor Dave Explains' }, expectedLabel: 'relevant' },
  { id: 'education-07', intentName: 'education', intent: educationIntent, videoMeta: { title: 'How to Study for Exams: Evidence-Based Tips', channel: 'Thomas Frank' }, expectedLabel: 'relevant' },
  { id: 'education-08', intentName: 'education', intent: educationIntent, videoMeta: { title: 'The Pythagorean Theorem Visualized', channel: '3Blue1Brown' }, expectedLabel: 'relevant' },
  { id: 'education-09', intentName: 'education', intent: educationIntent, videoMeta: { title: 'Basic First Aid: What to Do in an Emergency', channel: 'St John Ambulance' }, expectedLabel: 'relevant' },
  { id: 'education-10', intentName: 'education', intent: educationIntent, videoMeta: { title: 'How Volcanoes Form', channel: 'National Geographic' }, expectedLabel: 'relevant' },
  { id: 'education-11', intentName: 'education', intent: educationIntent, videoMeta: { title: 'Beginner French Lesson: Greetings', channel: 'Learn French with Alexa' }, expectedLabel: 'relevant' },
  { id: 'education-12', intentName: 'education', intent: educationIntent, videoMeta: { title: 'Understanding Compound Interest', channel: 'Khan Academy' }, expectedLabel: 'relevant' },
  { id: 'education-13', intentName: 'education', intent: educationIntent, videoMeta: { title: 'How to Read a Scientific Paper', channel: 'Andy Stapleton' }, expectedLabel: 'relevant' },
  { id: 'education-14', intentName: 'education', intent: educationIntent, videoMeta: { title: 'Movie Scene: Teacher Gives an Inspiring Speech', channel: 'Drama Clips' }, expectedLabel: 'distraction' },
  { id: 'education-15', intentName: 'education', intent: educationIntent, videoMeta: { title: 'Extreme Hide and Seek Challenge', channel: 'MrBeast' }, expectedLabel: 'distraction' },
  { id: 'education-16', intentName: 'education', intent: educationIntent, videoMeta: { title: 'Funny Cat Compilation #12', channel: 'Cute Animals Daily' }, expectedLabel: 'distraction' },
];
