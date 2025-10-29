# three-js-hero-waves

Full-screen hero with smooth shader-driven sine waves using Three.js, plus demo content below.

## Preview
Open \`index.html\` in your browser. The hero background renders animated waves, and content sections follow below.

## Features
- Smooth, angle-free wave surface (adaptive mesh subdivisions)
- GPU-shader animation (custom vertex + fragment shaders)
- Responsive sizing and high-DPI rendering
- Reduced motion fallback (respects \`prefers-reduced-motion\`)

## Tech
- Three.js (CDN): \`three@0.160.0\`
- HTML/CSS/JS only — no build step required

## Structure


index.html
assets/
  css/styles.css
  js/hero-waves.js
  images/
    Tradoo_Logo_blau.svg
    Tradoo_Schriftlogo_blau.svg
    Tradoo_Bildlogo_blau.svg



## Customize
- Colors and wave behavior in \`assets/js/hero-waves.js\` via uniforms:
  - \`uAmp\` (amplitude), \`uFreq\` (frequency), \`uSpeed\` (speed)
  - \`uColorA\`, \`uColorB\`, \`uFog\` (colors)
- Hero content and buttons in \`index.html\`
- Styles in \`assets/css/styles.css\`

## Run locally
- Double-click \`index.html\`, or serve with a simple HTTP server.

Example (Node):


npx http-server . -p 5173 -c-1



## Deploy
Static hosting (GitHub Pages, Vercel, Netlify, etc.) — no server required.

## Git
Initial setup (SSH):


# Generate SSH key (if needed)
ssh-keygen -t ed25519 -C "you@example.com"

# Start agent and add key
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Add public key to GitHub → Settings → SSH and GPG keys
cat ~/.ssh/id_ed25519.pub

# Push
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:burbela/three-js-hero-waves.git
git push -u origin main



If SSH is inconvenient, use HTTPS with a Personal Access Token.

## License
MIT
