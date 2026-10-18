/** Vite's ?raw import: a file's contents as a string (used by landing.ts to inline the shell's CSS). */
declare module "*.css?raw" {
  const content: string;
  export default content;
}
