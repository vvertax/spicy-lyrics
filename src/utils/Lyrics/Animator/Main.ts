import { Animate as AnimateLegacy } from "./Lyrics/LyricsAnimator.ts";
import { Animate as AnimateBloom } from "./Lyrics/BloomAnimator.ts";
import { isBloomRenderer, $spaceGravityMode } from "../../stores.ts";
import { TimeSetter } from "./Lyrics/LyricsSetter.ts";
export const Lyrics = {
  Animate(position: number) {
    if (isBloomRenderer() && !$spaceGravityMode.get()) AnimateBloom(position);
    else AnimateLegacy(position);
  },
  TimeSetter,
};
