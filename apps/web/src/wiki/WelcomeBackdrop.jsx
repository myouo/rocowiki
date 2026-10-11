import React from "react";

/** The official 2000px login artwork has a transparent centre.
 * Its right-hand painted strip occupies x=1479..1999. Keep the original
 * background scale and align the fade with that strip, not the empty centre.
 */
export default function WelcomeBackdrop() {
  return <span className="rw-welcome-scene" aria-hidden="true" />;
}
