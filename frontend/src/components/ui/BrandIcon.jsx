import { siDiscord, siNetflix, siX, siUber } from "simple-icons";

// ─── Inline SVG paths for brands removed from simple-icons v16 ───────────────

const SLACK_PATH =
  "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.527 2.527 0 0 1 2.521 2.521 2.527 2.527 0 0 1-2.521 2.521H2.522A2.527 2.527 0 0 1 0 8.834a2.527 2.527 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.527 2.527 0 0 1 2.521-2.521A2.527 2.527 0 0 1 24 8.834a2.527 2.527 0 0 1-2.521 2.521h-2.521zm-1.271 0a2.527 2.527 0 0 1-2.521 2.521 2.527 2.527 0 0 1-2.521-2.521V2.522A2.527 2.527 0 0 1 15.166 0a2.527 2.527 0 0 1 2.521 2.522v6.312zm-2.521 10.123a2.527 2.527 0 0 1 2.521 2.522A2.527 2.527 0 0 1 15.166 24a2.527 2.527 0 0 1-2.521-2.521v-2.522h2.521zm0-1.271a2.527 2.527 0 0 1-2.521-2.521 2.527 2.527 0 0 1 2.521-2.522h6.312A2.527 2.527 0 0 1 24 15.165a2.527 2.527 0 0 1-2.521 2.521h-6.312z";

const AMAZON_PATH =
  "M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.493.13.12.177.09.336-.09.48-.459.427-1.073.868-1.846 1.32a15.946 15.946 0 0 1-3.38 1.558 21.16 21.16 0 0 1-6.31.921c-2.65 0-5.172-.444-7.562-1.331a20.432 20.432 0 0 1-4.17-2.148c-.232-.158-.28-.324-.162-.506zm21.5-5.078c-.231-.404-.686-.62-1.36-.58-1.01.065-1.99.304-2.99.604-1.6.486-2.983.937-3.73.773-.746-.163-.957-.975-.563-2.09.394-1.116 1.35-2.84 1.97-3.72.625-.878.554-1.002-.254-1.467-.807-.465-1.866-.115-2.578.498-.712.613-1.185 1.48-1.415 2.416-.23.937-.265 1.945-.094 2.906a6.32 6.32 0 0 0 1.015 2.44c.482.664 1.097 1.165 1.835 1.443.737.278 1.6.33 2.436.127a7.044 7.044 0 0 0 2.136-.898c.661-.41 1.27-.896 1.786-1.456.255-.28.343-.622.24-.957-.104-.335-.38-.584-.43-.539z";

// ─── Brand registry ───────────────────────────────────────────────────────────
// color = display hex for dark backgrounds
// X and Uber use brand black (#000) → override to near-white
// Slack is aubergine (#4A154B, too dark) → override to Slack red

const BRAND = {
  Discord:      { path: siDiscord.path, color: `#${siDiscord.hex}` },  // blurple
  Netflix:      { path: siNetflix.path, color: `#${siNetflix.hex}` },  // red
  "Twitter / X":{ path: siX.path,       color: "#E8E8E8"            },  // X is #000
  Slack:        { path: SLACK_PATH,     color: "#E01E5A"             },  // Slack red
  Uber:         { path: siUber.path,    color: "#E8E8E8"             },  // Uber is #000
  Amazon:       { path: AMAZON_PATH,   color: "#FF9900"             },  // orange
};

/**
 * Renders a brand SVG icon from the registry.
 *
 * @param {Object} props
 * @param {string} props.company  - Must match a key in BRAND
 * @param {number} [props.size]   - px (default 20)
 * @param {string} [props.className]
 */
export default function BrandIcon({ company, size = 20, className = "" }) {
  const data = BRAND[company];
  if (!data) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={data.color}
      role="img"
      aria-label={company}
      className={`shrink-0 ${className}`}
    >
      <path d={data.path} />
    </svg>
  );
}
