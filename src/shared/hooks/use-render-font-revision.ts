import { useEffect, useState } from "react";

export const useRenderFontRevision = () => {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    const fonts = document.fonts;
    let active = true;
    const advance = () => {
      if (active) setRevision((current) => current + 1);
    };

    fonts.addEventListener("loadingdone", advance);
    void fonts.ready.then(advance);
    return () => {
      active = false;
      fonts.removeEventListener("loadingdone", advance);
    };
  }, []);

  return revision;
};
